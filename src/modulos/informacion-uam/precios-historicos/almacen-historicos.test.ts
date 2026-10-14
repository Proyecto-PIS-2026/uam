import { Temporal } from "temporal-polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { conBloqueoActualizacion, leerHistorico, type EstadoHistorico } from "./almacen-historicos";
import type { HistoricoProducto } from "./tipos";

const mocks = vi.hoisted(() => {
    type Fecha = { toString: () => string };
    type Registro = { especieId: number; historico: unknown; fechaDesde: Fecha; fechaHasta: Fecha; fechaUltimaActualizacion: Fecha };
    type Especie = { id: number; uamId: number | null };
    const registros = new Map<number, Registro>();
    const especies = new Map<number, Especie>();
    let cola: Promise<void> = Promise.resolve();
    const copiarJson = (valor: unknown): unknown => valor === undefined ? undefined : JSON.parse(JSON.stringify(valor));
    const copiar = (registro: Registro): Registro => ({ ...registro, historico: copiarJson(registro.historico) });
    const lecturas = vi.fn(async (filtro: { especieId: number }) => {
        const registro = registros.get(filtro.especieId);
        return registro ? copiar(registro) : null;
    });
    const creaciones = vi.fn(async (valores: Registro) => {
        if (registros.has(valores.especieId)) throw new Error("Registro duplicado en el mock");
        if (!especies.has(valores.especieId)) throw new Error("Se debe usar la clave interna de Especie");
        registros.set(valores.especieId, copiar(valores));
    });
    const actualizaciones = vi.fn(async (filtro: { especieId: number }, valores: Partial<Registro>) => {
        const actual = registros.get(filtro.especieId);
        if (!actual) throw new Error("Registro inexistente en el mock");
        registros.set(filtro.especieId, copiar({ ...actual, ...valores }));
    });
    const tabla = {
        where: (filtro: { especieId: number }) => ({
            first: () => lecturas(filtro),
            update: (valores: Partial<Registro>) => actualizaciones(filtro, valores),
        }),
        create: creaciones,
    };
    const lecturasEspecies = vi.fn(async (filtro: { uamId: number }, columnas: string[]) => {
        const especie = [...especies.values()].find((valor) => valor.uamId === filtro.uamId);
        return especie ? Object.fromEntries(columnas.map((columna) => [columna, especie[columna as keyof Especie]])) : null;
    });
    const tablaEspecies = {
        where: (filtro: { uamId: number }) => ({
            select: (...columnas: string[]) => ({ first: () => lecturasEspecies(filtro, columnas) }),
        }),
    };
    const bloqueos = vi.fn<(_consulta: { texto: string; valores: unknown[] }) => Promise<void>>(async () => undefined);
    const tx = { orm: { public: { Especie: tablaEspecies, HistoricoPrecios: tabla } }, execute: bloqueos };
    const lecturasFueraTransaccion = vi.fn();
    const transacciones = vi.fn(async (trabajo: (transaccion: typeof tx) => Promise<unknown>) => {
        const anterior = cola;
        let liberar!: () => void;
        cola = new Promise<void>((resolve) => { liberar = resolve; });
        await anterior;
        const copiaInicial = [...registros].map(([id, valor]) => [id, copiar(valor)] as const);
        try { return await trabajo(tx); } catch (error) {
            registros.clear();
            for (const [id, valor] of copiaInicial) registros.set(id, valor);
            throw error;
        } finally { liberar(); }
    });
    return {
        base: {
            orm: { public: {
                Especie: { ...tablaEspecies, where: (filtro: { uamId: number }) => {
                    lecturasFueraTransaccion("Especie");
                    return tablaEspecies.where(filtro);
                } },
                HistoricoPrecios: { ...tabla, where: (filtro: { especieId: number }) => {
                    lecturasFueraTransaccion("HistoricoPrecios");
                    return tabla.where(filtro);
                } },
            } },
            transaction: transacciones,
            raw: { sql: (partes: TemplateStringsArray, ...valores: unknown[]) => ({
                returnsRow: () => ({ build: () => ({ texto: partes.join("?"), valores }) }),
            }) },
        },
        lecturas, lecturasEspecies, creaciones, actualizaciones, bloqueos, transacciones, lecturasFueraTransaccion,
        sembrar: (registro: Registro) => registros.set(registro.especieId, copiar(registro)),
        leer: (especieId: number) => {
            const registro = registros.get(especieId);
            return registro ? copiar(registro) : null;
        },
        ids: () => [...registros.keys()],
        registrarEspecie: (id: number, uamId: number | null) => especies.set(id, { id, uamId }),
        reiniciar: () => {
            registros.clear();
            especies.clear();
            especies.set(101, { id: 101, uamId: 60 });
            especies.set(205, { id: 205, uamId: 61 });
            cola = Promise.resolve();
            for (const mock of [lecturas, lecturasEspecies, creaciones, actualizaciones,
                bloqueos, transacciones, lecturasFueraTransaccion]) mock.mockClear();
        },
    };
});
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: mocks.base }));

function historico(fecha = "2026-10-01", speciesId = 60): HistoricoProducto {
    return {
        classification_id: 2, classification: "Importados", species_id: speciesId, species: "Banana",
        from: fecha, to: fecha,
        series: [{ date: fecha, volume_kg: 100, presentations: [{
            variety: "Cavendish", caliber: "G", country: "ECUADOR", measure_unit: "KG",
            prices: [{ category: "I", min_kg: 70, max_kg: 75, min_un: 70, max_un: 75, is_reference: true }],
        }] }],
    };
}
function estado(fecha = "2026-10-01", speciesId = 60): EstadoHistorico {
    return { fechaUltimaActualizacion: fecha, historico: historico(fecha, speciesId) };
}
function guardarConBloqueo(estado: EstadoHistorico): Promise<void> {
    return conBloqueoActualizacion(estado.historico.species_id, (almacen) => almacen.guardar(estado));
}
function registro(especieId = 101, fecha = "2026-10-01", contenido: unknown = historico()) {
    return {
        especieId, historico: contenido, fechaDesde: Temporal.PlainDate.from("2026-10-01"),
        fechaHasta: Temporal.PlainDate.from(fecha), fechaUltimaActualizacion: Temporal.PlainDate.from(fecha),
    };
}
beforeEach(mocks.reiniciar);

describe("almacén de históricos", () => {
    it("usa la clave interna de Especie y guarda JSONB y las tres fechas de la tabla dedicada", async () => {
        await guardarConBloqueo(estado());
        expect(mocks.ids()).toEqual([101]);
        expect(mocks.lecturasEspecies).toHaveBeenCalledWith({ uamId: 60 }, ["id"]);
        const guardado = mocks.leer(101)!;
        expect(Object.keys(guardado).sort()).toEqual(["especieId", "fechaDesde", "fechaHasta", "fechaUltimaActualizacion", "historico"]);
        expect(guardado.historico).toStrictEqual(historico());
        expect(typeof guardado.historico).toBe("object");
        expect(guardado.fechaDesde).toBeInstanceOf(Temporal.PlainDate);
        expect(guardado.fechaHasta.toString()).toBe("2026-10-01");
        expect(guardado.fechaUltimaActualizacion.toString()).toBe("2026-10-01");
    });
    it("incorpora novedades a la misma fila y amplía las columnas de cobertura", async () => {
        await guardarConBloqueo(estado());
        await guardarConBloqueo(estado("2026-10-08"));
        const guardado = await leerHistorico(60);
        expect(mocks.ids()).toEqual([101]);
        expect(mocks.creaciones).toHaveBeenCalledOnce();
        expect(mocks.actualizaciones).toHaveBeenCalledOnce();
        expect(guardado?.fechaUltimaActualizacion).toBe("2026-10-08");
        expect(guardado?.historico.from).toBe("2026-10-01");
        expect(guardado?.historico.to).toBe("2026-10-08");
        expect(guardado?.historico.series).toEqual([historico().series[0], historico("2026-10-08").series[0]]);
        expect(mocks.leer(101)?.fechaDesde.toString()).toBe("2026-10-01");
        expect(mocks.leer(101)?.fechaHasta.toString()).toBe("2026-10-08");
    });
    it("mantiene una fila por especie aunque las claves internas difieran de los identificadores UAM", async () => {
        await guardarConBloqueo(estado("2026-10-01", 60));
        await guardarConBloqueo(estado("2026-10-08", 61));
        expect(mocks.ids()).toEqual([101, 205]);
        expect(await leerHistorico(60)).toEqual(estado("2026-10-01", 60));
        expect(await leerHistorico(61)).toEqual(estado("2026-10-08", 61));
    });
    it("conserva texto, nulos, mínimos mayores al máximo y objetos crudos al guardar y leer JSONB", async () => {
        const recibido = estado();
        Object.assign(recibido.historico.series[0].presentations[0], { variety: { nombre: "Especial" } });
        Object.assign(recibido.historico.series[0].presentations[0].prices[0], {
            min_kg: "Ñ", max_kg: null, min_un: 200, max_un: 75, is_reference: [false],
        });
        const original = structuredClone(recibido);
        await guardarConBloqueo(recibido);
        await guardarConBloqueo(estado("2026-10-08"));
        const guardado = await leerHistorico(60);
        expect(guardado?.historico.series[0]).toStrictEqual(original.historico.series[0]);
        expect((mocks.leer(101)?.historico as HistoricoProducto).series[0]).toStrictEqual(original.historico.series[0]);
        expect(await leerHistorico(60)).toStrictEqual(guardado);
        expect(mocks.ids()).toEqual([101]);
        expect(recibido).toStrictEqual(original);
    });
    it("una respuesta atrasada completa información sin retroceder la última actualización", async () => {
        await guardarConBloqueo(estado("2026-10-08"));
        await guardarConBloqueo(estado("2026-10-02"));
        const guardado = await leerHistorico(60);
        expect(guardado?.fechaUltimaActualizacion).toBe("2026-10-08");
        expect(guardado?.historico.series.map((dia) => dia.date)).toEqual(["2026-10-02", "2026-10-08"]);
        expect(mocks.leer(101)?.fechaUltimaActualizacion.toString()).toBe("2026-10-08");
        expect(mocks.leer(101)?.fechaDesde.toString()).toBe("2026-10-02");
        expect(mocks.leer(101)?.fechaHasta.toString()).toBe("2026-10-08");
    });
    it("reintentar la misma respuesta no duplica información ni reescribe una fila sin cambios", async () => {
        const recibido = estado();
        await guardarConBloqueo(recibido);
        const original = JSON.stringify(mocks.leer(101));
        await guardarConBloqueo(recibido);
        await guardarConBloqueo(recibido);
        expect(JSON.stringify(mocks.leer(101))).toBe(original);
        expect(mocks.creaciones).toHaveBeenCalledOnce();
        expect(mocks.actualizaciones).not.toHaveBeenCalled();
        expect(mocks.ids()).toHaveLength(1);
    });
    it("reutiliza el JSONB aunque sus claves y las de atributos anidados cambien de orden", async () => {
        const recibido = estado();
        Object.assign(recibido.historico.series[0].presentations[0], {
            variety: { nombre: "Especial", detalle: { pais: "URUGUAY", calibre: "G" } },
        });
        Object.assign(recibido.historico.series[0].presentations[0].prices[0], {
            category: { codigo: "I", detalle: { medida: "KG", cantidad: 1 } },
        });
        const original = structuredClone(recibido);
        function reordenar(valor: unknown): unknown {
            if (Array.isArray(valor)) return valor.map(reordenar);
            if (valor === null || typeof valor !== "object") return valor;
            const campos = valor as Record<string, unknown>;
            return Object.fromEntries(Object.keys(campos).reverse().map((clave) => [clave, reordenar(campos[clave])]));
        }

        await guardarConBloqueo(recibido);
        const registroGuardado = mocks.leer(101)!;
        mocks.sembrar({ ...registroGuardado, historico: reordenar(registroGuardado.historico) });
        const antes = JSON.stringify(mocks.leer(101));
        await guardarConBloqueo(recibido);
        const resultado = await leerHistorico(60);

        expect(JSON.stringify(mocks.leer(101))).toBe(antes);
        expect(resultado?.historico).toStrictEqual(original.historico);
        expect(resultado?.historico.series[0].presentations).toHaveLength(1);
        expect(resultado?.historico.series[0].presentations[0].prices).toHaveLength(1);
        expect(mocks.creaciones).toHaveBeenCalledOnce();
        expect(mocks.actualizaciones).not.toHaveBeenCalled();
        expect(recibido).toStrictEqual(original);
    });
    it("normaliza fechas, presentaciones y categorías duplicadas desde la primera importación", async () => {
        const recibido = estado();
        const dia = recibido.historico.series[0];
        const presentacion = dia.presentations[0];
        const precio = presentacion.prices[0];
        presentacion.prices.push({ ...precio, min_kg: 999 });
        dia.presentations.push({ ...presentacion, prices: [{ ...precio, category: "II" }, { ...precio, category: "II", min_kg: 888 }] });
        recibido.historico.series.push(structuredClone(dia));
        const original = structuredClone(recibido);
        await guardarConBloqueo(recibido);
        const serializado = JSON.stringify(mocks.leer(101));
        const guardado = await leerHistorico(60);
        expect(guardado?.historico.series).toHaveLength(1);
        expect(guardado?.historico.series[0].presentations).toHaveLength(1);
        expect(guardado?.historico.series[0].presentations[0].prices).toEqual([
            original.historico.series[0].presentations[0].prices[0],
            { ...original.historico.series[0].presentations[0].prices[0], category: "II" },
        ]);
        await guardarConBloqueo(recibido);
        expect(JSON.stringify(mocks.leer(101))).toBe(serializado);
        expect(mocks.creaciones).toHaveBeenCalledOnce();
        expect(mocks.actualizaciones).not.toHaveBeenCalled();
        expect(recibido).toStrictEqual(original);
    });
    it("combina actualizaciones simultáneas sin perder fechas ni crear filas duplicadas", async () => {
        await Promise.all([guardarConBloqueo(estado("2026-10-08")), guardarConBloqueo(estado("2026-10-01")), guardarConBloqueo(estado("2026-10-04"))]);
        const guardado = await leerHistorico(60);
        expect(guardado?.historico.series.map((dia) => dia.date)).toEqual(["2026-10-01", "2026-10-04", "2026-10-08"]);
        expect(guardado?.fechaUltimaActualizacion).toBe("2026-10-08");
        expect(mocks.creaciones).toHaveBeenCalledOnce();
        expect(mocks.ids()).toHaveLength(1);
    });
    it("resuelve la clave interna dentro de la transacción y bloquea antes de leer o escribir", async () => {
        await guardarConBloqueo(estado());
        expect(mocks.bloqueos).toHaveBeenCalledOnce();
        expect(mocks.bloqueos).toHaveBeenCalledWith({ texto: expect.stringContaining("pg_advisory_xact_lock(1725, ?)"), valores: [60] });
        expect(mocks.transacciones.mock.invocationCallOrder[0]).toBeLessThan(mocks.lecturasEspecies.mock.invocationCallOrder[0]);
        expect(mocks.bloqueos.mock.invocationCallOrder[0]).toBeLessThan(mocks.lecturasEspecies.mock.invocationCallOrder[0]);
        expect(mocks.bloqueos.mock.invocationCallOrder[0]).toBeLessThan(mocks.lecturas.mock.invocationCallOrder[0]);
        expect(mocks.lecturas.mock.invocationCallOrder[0]).toBeLessThan(mocks.creaciones.mock.invocationCallOrder[0]);
    });
    it("devuelve null para una especie registrada pero todavía no importada", async () => {
        await expect(leerHistorico(60)).resolves.toBeNull();
        expect(mocks.lecturasEspecies).toHaveBeenCalledWith({ uamId: 60 }, ["id"]);
        expect(mocks.lecturas).toHaveBeenCalledWith({ especieId: 101 });
        expect(mocks.transacciones).not.toHaveBeenCalled();
    });
    it("una especie UAM no registrada no provoca lecturas de histórico ni crea una clave externa", async () => {
        await expect(leerHistorico(999)).resolves.toBeNull();
        await expect(guardarConBloqueo(estado("2026-10-01", 999))).rejects.toThrow("no está registrada");
        expect(mocks.lecturas).not.toHaveBeenCalled();
        expect(mocks.creaciones).not.toHaveBeenCalled();
        expect(mocks.bloqueos).toHaveBeenCalledWith({ texto: expect.stringContaining("pg_advisory_xact_lock(1725, ?)"), valores: [999] });
        expect(mocks.ids()).toEqual([]);
    });
    it.each([["JSONB textual", "{"], ["histórico nulo", null], ["histórico incompleto", { series: [] }], ["especie diferente", historico("2026-10-01", 61)]])
        ("rechaza la lectura con %s sin borrar ni reemplazar los datos", async (_motivo, contenido) => {
            mocks.sembrar(registro(101, "2026-10-01", contenido));
            const original = JSON.stringify(mocks.leer(101));
            await expect(leerHistorico(60)).rejects.toThrow();
            expect(JSON.stringify(mocks.leer(101))).toBe(original);
            expect(mocks.creaciones).not.toHaveBeenCalled();
            expect(mocks.actualizaciones).not.toHaveBeenCalled();
        });
});

describe("bloqueo de actualización por especie", () => {
    it("lee y guarda con una única transacción protegida por el bloqueo de solicitud", async () => {
        const resultado = await conBloqueoActualizacion(60, async (almacen) => {
            expect(await almacen.leer()).toBeNull();
            await almacen.guardar(estado("2026-10-08"));
            expect(await almacen.leer()).toEqual(estado("2026-10-08"));
            return "terminada";
        });

        expect(resultado).toBe("terminada");
        expect(mocks.transacciones).toHaveBeenCalledOnce();
        expect(mocks.lecturasFueraTransaccion).not.toHaveBeenCalled();
        expect(mocks.bloqueos.mock.calls.map(([consulta]) => consulta)).toEqual([
            { texto: expect.stringContaining("pg_advisory_xact_lock(1725, ?)"), valores: [60] },
        ]);
        expect(mocks.bloqueos.mock.invocationCallOrder[0]).toBeLessThan(mocks.lecturasEspecies.mock.invocationCallOrder[0]);
        expect(mocks.ids()).toEqual([101]);
    });

    it("rechaza guardar una especie diferente de la bloqueada antes de escribir", async () => {
        await expect(conBloqueoActualizacion(60, async (almacen) => {
            await almacen.guardar(estado("2026-10-08", 61));
        })).rejects.toThrow("especie bloqueada");

        expect(mocks.ids()).toEqual([]);
        expect(mocks.creaciones).not.toHaveBeenCalled();
        expect(mocks.actualizaciones).not.toHaveBeenCalled();
        expect(mocks.lecturasEspecies).toHaveBeenCalledOnce();
        expect(mocks.lecturasEspecies).toHaveBeenCalledWith({ uamId: 60 }, ["id"]);
        expect(mocks.bloqueos).toHaveBeenCalledOnce();
        expect(mocks.transacciones).toHaveBeenCalledOnce();
    });

    it("rechaza una especie no registrada antes del callback y libera el bloqueo para la siguiente solicitud", async () => {
        const trabajo = vi.fn(async () => "no debe consultarse");
        await expect(conBloqueoActualizacion(999, trabajo)).rejects.toThrow("La especie no está registrada en la base de datos.");

        expect(trabajo).not.toHaveBeenCalled();
        expect(mocks.lecturasEspecies).toHaveBeenCalledWith({ uamId: 999 }, ["id"]);
        expect(mocks.lecturas).not.toHaveBeenCalled();
        expect(mocks.creaciones).not.toHaveBeenCalled();
        expect(mocks.actualizaciones).not.toHaveBeenCalled();
        expect(mocks.lecturasFueraTransaccion).not.toHaveBeenCalled();
        expect(mocks.transacciones).toHaveBeenCalledOnce();
        expect(mocks.bloqueos).toHaveBeenCalledWith({ texto: expect.stringContaining("pg_advisory_xact_lock(1725, ?)"), valores: [999] });
        mocks.registrarEspecie(301, 999);
        await expect(conBloqueoActualizacion(999, trabajo)).resolves.toBe("no debe consultarse");
        expect(trabajo).toHaveBeenCalledOnce();
        expect(mocks.transacciones).toHaveBeenCalledTimes(2);
    });

    it("un fallo libera la transacción pendiente y permite continuar sin conservar la escritura fallida", async () => {
        let avisarInicio!: () => void;
        let rechazar!: (error: Error) => void;
        const inicio = new Promise<void>((resolve) => { avisarInicio = resolve; });
        const espera = new Promise<void>((_resolve, reject) => { rechazar = reject; });
        const primera = conBloqueoActualizacion(60, async (almacen) => {
            await almacen.guardar(estado("2026-10-08"));
            avisarInicio();
            await espera;
        });
        const falloEsperado = expect(primera).rejects.toThrow("Fallo simulado");
        await inicio;
        const segunda = conBloqueoActualizacion(60, async (almacen) => {
            expect(await almacen.leer()).toBeNull();
            await almacen.guardar(estado("2026-10-09"));
            return "recuperada";
        });
        rechazar(new Error("Fallo simulado"));

        await falloEsperado;
        await expect(segunda).resolves.toBe("recuperada");
        expect(mocks.transacciones).toHaveBeenCalledTimes(2);
        expect(mocks.lecturasFueraTransaccion).not.toHaveBeenCalled();
        expect(mocks.leer(101)?.fechaUltimaActualizacion.toString()).toBe("2026-10-09");
        expect((mocks.leer(101)?.historico as HistoricoProducto).series.map((dia) => dia.date)).toEqual(["2026-10-09"]);
    });

    it("relee el progreso después del bloqueo para que otra solicitud pueda omitir el pedido ya completado", async () => {
        mocks.sembrar(registro(101, "2026-10-08", historico("2026-10-08")));
        let responder!: (nuevo: EstadoHistorico) => void;
        let avisarPedido!: () => void;
        const pendiente = new Promise<EstadoHistorico>((resolve) => { responder = resolve; });
        const pedidoIniciado = new Promise<void>((resolve) => { avisarPedido = resolve; });
        const pedirNovedades = vi.fn(async () => {
            avisarPedido();
            return pendiente;
        });
        const actualizar = () => conBloqueoActualizacion(60, async (almacen) => {
            const anterior = await almacen.leer();
            if (anterior && anterior.fechaUltimaActualizacion >= "2026-10-09") return "omitida";
            await almacen.guardar(await pedirNovedades());
            return "actualizada";
        });

        const primera = actualizar();
        const segunda = actualizar();
        await pedidoIniciado;
        responder(estado("2026-10-09"));

        await expect(Promise.all([primera, segunda])).resolves.toEqual(["actualizada", "omitida"]);
        expect(pedirNovedades).toHaveBeenCalledOnce();
        expect(mocks.transacciones).toHaveBeenCalledTimes(2);
        expect(mocks.lecturasFueraTransaccion).not.toHaveBeenCalled();
        expect(mocks.actualizaciones).toHaveBeenCalledOnce();
    });
});
