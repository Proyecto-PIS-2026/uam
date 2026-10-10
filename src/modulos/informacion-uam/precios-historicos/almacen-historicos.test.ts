import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    guardarHistorico, leerHistorico, limpiarCacheAnterior, listarEspeciesGuardadas,
    nombreHistorico, registrarSincronizacion, sincronizacionCompletada, type EstadoHistorico,
} from "./almacen-historicos";
import type { HistoricoProducto } from "./tipos";

const {
    base, lecturas, creaciones, actualizaciones, transacciones, bloqueos,
    selecciones, listados, eliminaciones, lecturaTablaCompleta, sembrar, leer, nombres, reiniciar,
} = vi.hoisted(() => {
    type Registro = { id: number; nombreConfiguracion: string; valorConfiguracion: string };
    type Predicado = { patron: string };
    type Filtro = { nombreConfiguracion?: string; id?: number } | Predicado;
    type Selector = (columnas: { nombreConfiguracion: { like: (patron: string) => Predicado } }) => Predicado;
    const registros = new Map<string, Registro>();
    let siguienteId = 1;
    let cola: Promise<void> = Promise.resolve();

    const coincide = (registro: Registro, filtro: Filtro) => {
        if ("patron" in filtro) return registro.nombreConfiguracion.startsWith(filtro.patron.replace(/%$/, ""));
        return filtro.nombreConfiguracion !== undefined
            ? registro.nombreConfiguracion === filtro.nombreConfiguracion
            : registro.id === filtro.id;
    };
    const lecturas = vi.fn(async (filtro: Filtro): Promise<Registro | null> => {
        const registro = [...registros.values()].find((valor) => coincide(valor, filtro));
        return registro ? { ...registro } : null;
    });
    const creaciones = vi.fn(async (valores: Omit<Registro, "id">) => {
        if (registros.has(valores.nombreConfiguracion)) throw new Error("Registro duplicado en el mock");
        registros.set(valores.nombreConfiguracion, { id: siguienteId++, ...valores });
    });
    const actualizaciones = vi.fn(async (filtro: Filtro, valores: Pick<Registro, "valorConfiguracion">) => {
        const registro = [...registros.values()].find((valor) => coincide(valor, filtro));
        if (!registro) throw new Error("Registro inexistente en el mock");
        registro.valorConfiguracion = valores.valorConfiguracion;
    });
    const listados = vi.fn(async (filtro: Filtro, columna: string) => {
        if (columna !== "nombreConfiguracion") throw new Error("El listado no debe leer documentos históricos");
        return [...registros.values()].filter((registro) => coincide(registro, filtro))
            .map(({ nombreConfiguracion }) => ({ nombreConfiguracion }));
    });
    const selecciones = vi.fn();
    const eliminaciones = vi.fn(async (filtro: Filtro) => {
        for (const [nombre, registro] of registros) {
            if (coincide(registro, filtro)) registros.delete(nombre);
        }
    });
    const lecturaTablaCompleta = vi.fn(() => {
        throw new Error("No se debe leer la tabla completa de configuración");
    });
    const tabla = {
        where: (selector: Filtro | Selector) => {
            const filtro = typeof selector === "function"
                ? selector({ nombreConfiguracion: { like: (patron) => ({ patron }) } })
                : selector;
            return {
                first: () => lecturas(filtro),
                update: (valores: Pick<Registro, "valorConfiguracion">) => actualizaciones(filtro, valores),
                deleteAll: () => eliminaciones(filtro),
                select: (columna: string) => {
                    selecciones(columna);
                    return { all: () => listados(filtro, columna) };
                },
                all: lecturaTablaCompleta,
            };
        },
        create: creaciones,
        all: lecturaTablaCompleta,
    };
    const bloqueos = vi.fn<(_consulta: { texto: string; valores: unknown[] }) => Promise<void>>(async () => undefined);
    const tx = { orm: { public: { Configuracion: tabla } }, execute: bloqueos };
    const transacciones = vi.fn(async (trabajo: (transaccion: typeof tx) => Promise<unknown>) => {
        const anterior = cola;
        let liberar!: () => void;
        cola = new Promise<void>((resolve) => { liberar = resolve; });
        await anterior;
        try { return await trabajo(tx); }
        finally { liberar(); }
    });

    return {
        base: {
            orm: { public: { Configuracion: tabla } },
            transaction: transacciones,
            raw: {
                sql: (partes: TemplateStringsArray, ...valores: unknown[]) => ({
                    returnsRow: () => ({ build: () => ({ texto: partes.join("?"), valores }) }),
                }),
            },
        },
        lecturas, creaciones, actualizaciones, transacciones, bloqueos,
        selecciones, listados, eliminaciones, lecturaTablaCompleta,
        sembrar: (nombreConfiguracion: string, valorConfiguracion: string) => {
            registros.set(nombreConfiguracion, { id: siguienteId++, nombreConfiguracion, valorConfiguracion });
        },
        leer: (nombreConfiguracion: string) => registros.get(nombreConfiguracion)?.valorConfiguracion ?? null,
        nombres: () => [...registros.keys()],
        reiniciar: () => {
            registros.clear();
            siguienteId = 1;
            cola = Promise.resolve();
            for (const mock of [lecturas, creaciones, actualizaciones, transacciones, bloqueos,
                selecciones, listados, eliminaciones, lecturaTablaCompleta]) mock.mockClear();
        },
    };
});

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: base }));

const fuente = "fuente-de-prueba";
const claveSincronizacion = "precios-historicos:v2:sincronizacion";

function historico(fecha = "2026-10-01", speciesId = 60): HistoricoProducto {
    return {
        classification_id: 2, classification: "Importados", species_id: speciesId, species: "Banana",
        from: fecha, to: fecha,
        series: [{
            date: fecha, volume_kg: 100,
            presentations: [{
                variety: "Cavendish", caliber: "G", country: "ECUADOR", measure_unit: "KG",
                prices: [{ category: "I", min_kg: 70, max_kg: 75, min_un: 70, max_un: 75, is_reference: true }],
            }],
        }],
    };
}

function estado(fecha = "2026-10-01", speciesId = 60): EstadoHistorico {
    return { version: 2, fuente, fechaUltimaActualizacion: fecha, historico: historico(fecha, speciesId) };
}

beforeEach(reiniciar);

describe("almacén de históricos", () => {
    it("guarda e incorpora novedades a la misma fila de la especie", async () => {
        await guardarHistorico(estado());
        await guardarHistorico(estado("2026-10-08"));

        const guardado = await leerHistorico(60);
        expect(nombres()).toEqual([nombreHistorico(60)]);
        expect(creaciones).toHaveBeenCalledOnce();
        expect(actualizaciones).toHaveBeenCalledOnce();
        expect(guardado?.fechaUltimaActualizacion).toBe("2026-10-08");
        expect(guardado?.historico.from).toBe("2026-10-01");
        expect(guardado?.historico.to).toBe("2026-10-08");
        expect(guardado?.historico.series).toEqual([
            historico().series[0], historico("2026-10-08").series[0],
        ]);
    });

    it("mantiene una fila por especie y deja separadas sus fechas de actualización", async () => {
        await guardarHistorico(estado("2026-10-01", 60));
        await guardarHistorico(estado("2026-10-08", 61));

        expect(nombres()).toEqual([nombreHistorico(60), nombreHistorico(61)]);
        expect(await leerHistorico(60)).toEqual(estado("2026-10-01", 60));
        expect(await leerHistorico(61)).toEqual(estado("2026-10-08", 61));
    });

    it("una respuesta atrasada completa información sin retroceder la fecha de actualización", async () => {
        await guardarHistorico(estado("2026-10-08"));
        await guardarHistorico(estado("2026-10-02"));

        const guardado = await leerHistorico(60);
        expect(guardado?.fechaUltimaActualizacion).toBe("2026-10-08");
        expect(guardado?.historico.series.map((dia) => dia.date)).toEqual(["2026-10-02", "2026-10-08"]);
        expect(nombres()).toHaveLength(1);
    });

    it("reintentar la misma respuesta no duplica información ni reescribe una fila sin cambios", async () => {
        const recibido = estado();
        await guardarHistorico(recibido);
        const serializado = leer(nombreHistorico(60));
        await guardarHistorico(recibido);
        await guardarHistorico(recibido);

        expect(leer(nombreHistorico(60))).toBe(serializado);
        expect(creaciones).toHaveBeenCalledOnce();
        expect(actualizaciones).not.toHaveBeenCalled();
        expect(nombres()).toHaveLength(1);
    });

    it("normaliza fechas, presentaciones y categorías duplicadas desde la primera importación", async () => {
        const recibido = estado();
        const dia = recibido.historico.series[0];
        const presentacion = dia.presentations[0];
        const precio = presentacion.prices[0];
        presentacion.prices.push({ ...precio, min_kg: 999 });
        dia.presentations.push({
            ...presentacion,
            prices: [{ ...precio, category: "II" }, { ...precio, category: "II", min_kg: 888 }],
        });
        recibido.historico.series.push(structuredClone(dia));
        const original = structuredClone(recibido);

        await guardarHistorico(recibido);
        const serializado = leer(nombreHistorico(60));
        const guardado = await leerHistorico(60);
        expect(guardado?.historico.series).toHaveLength(1);
        expect(guardado?.historico.series[0].presentations).toHaveLength(1);
        expect(guardado?.historico.series[0].presentations[0].prices).toEqual([
            original.historico.series[0].presentations[0].prices[0],
            { ...original.historico.series[0].presentations[0].prices[0], category: "II" },
        ]);

        await guardarHistorico(recibido);
        expect(leer(nombreHistorico(60))).toBe(serializado);
        expect(creaciones).toHaveBeenCalledOnce();
        expect(actualizaciones).not.toHaveBeenCalled();
        expect(recibido).toStrictEqual(original);
    });

    it("combina actualizaciones simultáneas bajo el bloqueo sin perder fechas ni crear filas duplicadas", async () => {
        await Promise.all([
            guardarHistorico(estado("2026-10-08")),
            guardarHistorico(estado("2026-10-01")),
            guardarHistorico(estado("2026-10-04")),
        ]);

        const guardado = await leerHistorico(60);
        expect(guardado?.historico.series.map((dia) => dia.date)).toEqual([
            "2026-10-01", "2026-10-04", "2026-10-08",
        ]);
        expect(guardado?.fechaUltimaActualizacion).toBe("2026-10-08");
        expect(creaciones).toHaveBeenCalledOnce();
        expect(nombres()).toHaveLength(1);
    });

    it("rechaza un cambio de fuente conservando intactos el histórico y su fecha", async () => {
        await guardarHistorico(estado());
        const serializado = leer(nombreHistorico(60));

        await expect(guardarHistorico({ ...estado("2026-10-08"), fuente: "otra-fuente" }))
            .rejects.toThrow("fuente");

        expect(leer(nombreHistorico(60))).toBe(serializado);
        expect(actualizaciones).not.toHaveBeenCalled();
        expect(nombres()).toHaveLength(1);
    });

    it("adquiere el bloqueo de la especie antes de releer o guardar la fila", async () => {
        await guardarHistorico(estado());

        expect(bloqueos).toHaveBeenCalledWith({
            texto: expect.stringContaining("pg_advisory_xact_lock(1724, ?)"),
            valores: [60],
        });
        expect(bloqueos.mock.invocationCallOrder[0]).toBeLessThan(lecturas.mock.invocationCallOrder[0]);
        expect(lecturas.mock.invocationCallOrder[0]).toBeLessThan(creaciones.mock.invocationCallOrder[0]);
        expect(transacciones).toHaveBeenCalledOnce();
    });

    it("devuelve null para una especie todavía no importada sin abrir una transacción", async () => {
        await expect(leerHistorico(60)).resolves.toBeNull();
        expect(lecturas).toHaveBeenCalledWith({ nombreConfiguracion: nombreHistorico(60) });
        expect(transacciones).not.toHaveBeenCalled();
    });

    it.each([
        ["JSON corrupto", "{"],
        ["estado nulo", "null"],
        ["versión incorrecta", JSON.stringify({ ...estado(), version: 1 })],
        ["fuente inválida", JSON.stringify({ ...estado(), fuente: null })],
        ["fecha inexistente", JSON.stringify({ ...estado(), fechaUltimaActualizacion: "2026-02-30" })],
        ["fecha ausente", JSON.stringify({ ...estado(), fechaUltimaActualizacion: undefined })],
        ["histórico ausente", JSON.stringify({ ...estado(), historico: undefined })],
        ["histórico incompleto", JSON.stringify({ ...estado(), historico: { series: [] } })],
        ["especie diferente", JSON.stringify(estado("2026-10-01", 61))],
    ])("rechaza la lectura con %s sin borrar ni reemplazar los datos", async (_motivo, serializado) => {
        sembrar(nombreHistorico(60), serializado);

        await expect(leerHistorico(60)).rejects.toThrow();
        expect(leer(nombreHistorico(60))).toBe(serializado);
        expect(creaciones).not.toHaveBeenCalled();
        expect(actualizaciones).not.toHaveBeenCalled();
    });

    it("lista solamente los nombres de históricos v2 sin cargar los documentos ni otras configuraciones", async () => {
        sembrar(nombreHistorico(60), "documento que no debe leerse");
        sembrar(nombreHistorico(61), "otro documento que no debe leerse");
        for (const id of ["0", "-1", "abc", "1.5", "9007199254740992"]) {
            sembrar(`precios-historicos:v2:especie:${id}`, "{}");
        }
        sembrar("precios-historicos:v1:anterior", "{}");
        sembrar(claveSincronizacion, "{}");
        sembrar("otra-configuracion", "{}");

        await expect(listarEspeciesGuardadas()).resolves.toEqual([60, 61]);
        expect(selecciones).toHaveBeenCalledOnce();
        expect(selecciones).toHaveBeenCalledWith("nombreConfiguracion");
        expect(listados).toHaveBeenCalledWith({ patron: "precios-historicos:v2:especie:%" }, "nombreConfiguracion");
        expect(lecturaTablaCompleta).not.toHaveBeenCalled();
        expect(lecturas).not.toHaveBeenCalled();
    });
});

describe("marcador de sincronización y limpieza", () => {
    it("considera incompleta una sincronización sin marcador, de otra fuente o de otra fecha", async () => {
        await expect(sincronizacionCompletada("2026-10-08", fuente)).resolves.toBe(false);
        await registrarSincronizacion("2026-10-08", fuente);

        await expect(sincronizacionCompletada("2026-10-08", fuente)).resolves.toBe(true);
        await expect(sincronizacionCompletada("2026-10-09", fuente)).resolves.toBe(false);
        await expect(sincronizacionCompletada("2026-10-08", "otra-fuente")).resolves.toBe(false);
        expect(bloqueos).toHaveBeenCalledWith({
            texto: expect.stringContaining("pg_advisory_xact_lock(1724, 0)"), valores: [],
        });
    });

    it("actualiza el mismo marcador y conserva las filas de las especies", async () => {
        await guardarHistorico(estado());
        const serializado = leer(nombreHistorico(60));
        await registrarSincronizacion("2026-10-08", fuente);
        await registrarSincronizacion("2026-10-09", fuente);

        expect(nombres()).toEqual([nombreHistorico(60), claveSincronizacion]);
        expect(leer(nombreHistorico(60))).toBe(serializado);
        expect(JSON.parse(leer(claveSincronizacion)!)).toEqual({
            version: 2, fuente, fechaUltimaActualizacion: "2026-10-09",
        });
        await expect(sincronizacionCompletada("2026-10-09", fuente)).resolves.toBe(true);
    });

    it.each(["{", "null", JSON.stringify({ version: 1, fuente, fechaUltimaActualizacion: "2026-10-08" })])
        ("no da por completada la sincronización con un marcador inválido: %s", async (valor) => {
            sembrar(claveSincronizacion, valor);
            await expect(sincronizacionCompletada("2026-10-08", fuente)).resolves.toBe(false);
        });

    it("la limpieza elimina exclusivamente cachés históricas v1", async () => {
        for (const nombre of [
            "precios-historicos:v1:primera", "precios-historicos:v1:segunda",
            nombreHistorico(60), claveSincronizacion, "precios-historicos:v10:otra",
            "precios-referencia:v1:diario", "otra-configuracion",
        ]) sembrar(nombre, "{}");

        await limpiarCacheAnterior();

        expect(nombres()).toEqual([
            nombreHistorico(60), claveSincronizacion, "precios-historicos:v10:otra",
            "precios-referencia:v1:diario", "otra-configuracion",
        ]);
        expect(eliminaciones).toHaveBeenCalledWith({ patron: "precios-historicos:v1:%" });
        expect(lecturaTablaCompleta).not.toHaveBeenCalled();
    });
});
