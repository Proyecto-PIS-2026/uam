import { Temporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { conBloqueoActualizacion, leerHistorico, type EstadoHistorico } from "./almacen-historicos";
import type { HistoricoProducto } from "./tipos";

const mocks = vi.hoisted(() => {
    type Fecha = { toString: () => string };
    type Registro = { especieId: number; historico: unknown; fechaDesde: Fecha; fechaHasta: Fecha; fechaUltimaActualizacion: Fecha };
    type Especie = { id: number; uamId: number | null };
    type Configuracion = { nombreConfiguracion: string; valorConfiguracion: string };
    const registros = new Map<number, Registro>();
    const especies = new Map<number, Especie>();
    const configuraciones = new Map<string, Configuracion>();
    let ahoraBase = 0;
    let activas = 0;
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
    const leerConfiguracion = vi.fn(async (filtro: { nombreConfiguracion: string }) => {
        const registro = configuraciones.get(filtro.nombreConfiguracion);
        return registro ? { ...registro } : null;
    });
    const crearConfiguracion = vi.fn(async (registro: Configuracion) => {
        if (configuraciones.has(registro.nombreConfiguracion)) throw new Error("Reserva duplicada");
        configuraciones.set(registro.nombreConfiguracion, { ...registro });
    });
    const actualizarConfiguracion = vi.fn(async (filtro: { nombreConfiguracion: string }, valores: { valorConfiguracion: string }) => {
        if (!configuraciones.has(filtro.nombreConfiguracion)) throw new Error("Reserva inexistente");
        configuraciones.set(filtro.nombreConfiguracion, { ...filtro, ...valores });
    });
    const eliminarConfiguracion = vi.fn(async (filtro: { nombreConfiguracion: string }) => {
        configuraciones.delete(filtro.nombreConfiguracion);
    });
    const tablaConfiguracion = {
        where: (filtro: { nombreConfiguracion: string }) => ({
            first: () => leerConfiguracion(filtro),
            update: (valores: { valorConfiguracion: string }) => actualizarConfiguracion(filtro, valores),
            delete: () => eliminarConfiguracion(filtro),
        }),
        create: crearConfiguracion,
    };
    const bloqueos = vi.fn<(_consulta: { texto: string; valores: unknown[] }) => Promise<void>>(async () => undefined);
    const reloj = vi.fn<(_consulta: { texto: string; valores: unknown[] }) => Promise<{ ahora: number }[]>>(async () => [{ ahora: ahoraBase }]);
    const tx = {
        orm: { public: { Especie: tablaEspecies, HistoricoPrecios: tabla, Configuracion: tablaConfiguracion } },
        execute: bloqueos, query: reloj,
    };
    const lecturasFueraTransaccion = vi.fn();
    const transacciones = vi.fn(async (trabajo: (transaccion: typeof tx) => Promise<unknown>) => {
        const anterior = cola;
        let liberar!: () => void;
        cola = new Promise<void>((resolve) => { liberar = resolve; });
        await anterior;
        activas++;
        const copiaInicial = [...registros].map(([id, valor]) => [id, copiar(valor)] as const);
        const configuracionesIniciales = [...configuraciones].map(([clave, valor]) => [clave, { ...valor }] as const);
        try { return await trabajo(tx); } catch (error) {
            registros.clear();
            for (const [id, valor] of copiaInicial) registros.set(id, valor);
            configuraciones.clear();
            for (const [clave, valor] of configuracionesIniciales) configuraciones.set(clave, valor);
            throw error;
        } finally { activas--; liberar(); }
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
        leerConfiguracion, crearConfiguracion, actualizarConfiguracion, eliminarConfiguracion, reloj,
        transaccionesActivas: () => activas,
        fijarRelojBase: (ahora: number) => { ahoraBase = ahora; },
        reserva: (speciesId: number) => {
            const registro = configuraciones.get(`precios-historicos:actualizacion:${speciesId}`);
            return registro ? JSON.parse(registro.valorConfiguracion) as { token: string; venceEn: number } : null;
        },
        sembrarReserva: (speciesId: number, valor: unknown) => {
            const nombreConfiguracion = `precios-historicos:actualizacion:${speciesId}`;
            configuraciones.set(nombreConfiguracion, { nombreConfiguracion, valorConfiguracion: JSON.stringify(valor) });
        },
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
            configuraciones.clear();
            ahoraBase = Date.parse("2026-10-09T12:00:00Z");
            activas = 0;
            especies.set(101, { id: 101, uamId: 60 });
            especies.set(205, { id: 205, uamId: 61 });
            cola = Promise.resolve();
            for (const mock of [lecturas, lecturasEspecies, creaciones, actualizaciones,
                bloqueos, transacciones, lecturasFueraTransaccion, leerConfiguracion,
                crearConfiguracion, actualizarConfiguracion, eliminarConfiguracion, reloj]) mock.mockClear();
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
afterEach(() => vi.useRealTimers());

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
    it("resuelve la clave interna dentro de las transacciones cortas y bloquea antes de reservar o escribir", async () => {
        await guardarConBloqueo(estado());
        expect(mocks.bloqueos).toHaveBeenCalledTimes(3);
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

describe("reserva de actualización por especie", () => {
    it("cierra la transacción antes del trabajo remoto y solo abre otra al guardar", async () => {
        let finalizarPedido!: () => void;
        let avisarPedido!: () => void;
        const pedido = new Promise<void>((resolve) => { finalizarPedido = resolve; });
        const inicio = new Promise<void>((resolve) => { avisarPedido = resolve; });
        const pendiente = conBloqueoActualizacion(60, async (almacen) => {
            expect(mocks.transaccionesActivas()).toBe(0);
            expect(await almacen.leer()).toBeNull();
            avisarPedido();
            await pedido;
            expect(mocks.transaccionesActivas()).toBe(0);
            await almacen.guardar(estado("2026-10-08"));
            expect(mocks.transaccionesActivas()).toBe(0);
            return "terminada";
        });
        await inicio;
        expect(mocks.transacciones).toHaveBeenCalledOnce();
        expect(mocks.transaccionesActivas()).toBe(0);
        expect(mocks.ids()).toEqual([]);
        expect(mocks.reserva(60)?.token).toEqual(expect.any(String));
        finalizarPedido();

        await expect(pendiente).resolves.toBe("terminada");
        expect(mocks.transacciones).toHaveBeenCalledTimes(3);
        expect(mocks.lecturasFueraTransaccion).toHaveBeenCalledWith("HistoricoPrecios");
        expect(mocks.ids()).toEqual([101]);
        expect(mocks.reserva(60)).toBeNull();
    });

    it("una especie puede guardar mientras otra espera la respuesta remota", async () => {
        let terminar!: () => void;
        let avisar!: () => void;
        const espera = new Promise<void>((resolve) => { terminar = resolve; });
        const inicio = new Promise<void>((resolve) => { avisar = resolve; });
        const primera = conBloqueoActualizacion(60, async () => { avisar(); await espera; });
        await inicio;

        await guardarConBloqueo(estado("2026-10-09", 61));

        expect(mocks.ids()).toEqual([205]);
        expect(mocks.transaccionesActivas()).toBe(0);
        expect(mocks.reserva(60)).not.toBeNull();
        terminar();
        await primera;
        expect(mocks.reserva(60)).toBeNull();
    });

    it("dos solicitudes coordinadas por la base comparten la actualización y esperan sin transacción", async () => {
        vi.useFakeTimers();
        mocks.sembrar(registro(101, "2026-10-08", historico("2026-10-08")));
        let responder!: (nuevo: EstadoHistorico) => void;
        let avisarPedido!: () => void;
        const pendiente = new Promise<EstadoHistorico>((resolve) => { responder = resolve; });
        const pedidoIniciado = new Promise<void>((resolve) => { avisarPedido = resolve; });
        const pedirNovedades = vi.fn(async () => { avisarPedido(); return pendiente; });
        const actualizar = () => conBloqueoActualizacion(60, async (almacen) => {
            const anterior = await almacen.leer();
            if (anterior && anterior.fechaUltimaActualizacion >= "2026-10-09") return "omitida";
            await almacen.guardar(await pedirNovedades());
            return "actualizada";
        });

        const primera = actualizar();
        await pedidoIniciado;
        const token = mocks.reserva(60)?.token;
        const segunda = actualizar();
        await vi.advanceTimersByTimeAsync(0);
        expect(mocks.reserva(60)?.token).toBe(token);
        expect(pedirNovedades).toHaveBeenCalledOnce();
        expect(mocks.transaccionesActivas()).toBe(0);
        expect(vi.getTimerCount()).toBe(1);
        responder(estado("2026-10-09"));
        await primera;
        await vi.advanceTimersByTimeAsync(1_000);

        await expect(Promise.all([primera, segunda])).resolves.toEqual(["actualizada", "omitida"]);
        expect(pedirNovedades).toHaveBeenCalledOnce();
        expect(mocks.actualizaciones).toHaveBeenCalledOnce();
        expect(mocks.reserva(60)).toBeNull();
    });

    it("calcula la vigencia con el reloj de la base y recupera una reserva vencida", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2035-01-01T00:00:00Z"));
        mocks.fijarRelojBase(10_000);
        mocks.sembrarReserva(60, { token: "instancia-caida", venceEn: 10_000 });
        await conBloqueoActualizacion(60, async (almacen) => {
            expect(mocks.reserva(60)).toEqual({ token: expect.any(String), venceEn: 370_000 });
            expect(mocks.reserva(60)?.token).not.toBe("instancia-caida");
            await almacen.guardar(estado());
        });

        expect(mocks.actualizarConfiguracion).toHaveBeenCalledOnce();
        expect(mocks.reloj.mock.calls.every(([consulta]) => consulta.texto.includes("clock_timestamp()"))).toBe(true);
        expect(mocks.ids()).toEqual([101]);
        expect(mocks.reserva(60)).toBeNull();
    });

    it("una reserva ajena vigente no inicia el trabajo aunque el reloj de la aplicación esté adelantado", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2035-01-01T00:00:00Z"));
        mocks.fijarRelojBase(10_000);
        mocks.sembrarReserva(60, { token: "otra-instancia", venceEn: 20_000 });
        const trabajo = vi.fn(async () => "recuperada");
        const pendiente = conBloqueoActualizacion(60, trabajo);
        await vi.advanceTimersByTimeAsync(1_000);

        expect(trabajo).not.toHaveBeenCalled();
        expect(mocks.transaccionesActivas()).toBe(0);
        expect(mocks.reserva(60)?.token).toBe("otra-instancia");
        mocks.fijarRelojBase(20_000);
        await vi.advanceTimersByTimeAsync(1_000);
        await expect(pendiente).resolves.toBe("recuperada");
        expect(trabajo).toHaveBeenCalledOnce();
    });

    it("una solicitud vencida no puede guardar ni liberar la reserva de quien la reemplazó", async () => {
        mocks.fijarRelojBase(0);
        let continuarPrimera!: () => void;
        let continuarSegunda!: () => void;
        let avisarPrimera!: () => void;
        let avisarSegunda!: () => void;
        const esperaPrimera = new Promise<void>((resolve) => { continuarPrimera = resolve; });
        const esperaSegunda = new Promise<void>((resolve) => { continuarSegunda = resolve; });
        const inicioPrimera = new Promise<void>((resolve) => { avisarPrimera = resolve; });
        const inicioSegunda = new Promise<void>((resolve) => { avisarSegunda = resolve; });
        const primera = conBloqueoActualizacion(60, async (almacen) => {
            avisarPrimera();
            await esperaPrimera;
            await almacen.guardar(estado("2026-10-08"));
        });
        const rechazo = expect(primera).rejects.toThrow("venció o fue reemplazada");
        await inicioPrimera;
        const primerToken = mocks.reserva(60)?.token;
        mocks.fijarRelojBase(360_000);
        const segunda = conBloqueoActualizacion(60, async (almacen) => {
            avisarSegunda();
            await esperaSegunda;
            await almacen.guardar(estado("2026-10-09"));
        });
        await inicioSegunda;
        const segundoToken = mocks.reserva(60)?.token;
        expect(segundoToken).not.toBe(primerToken);
        continuarPrimera();
        await rechazo;

        expect(mocks.ids()).toEqual([]);
        expect(mocks.reserva(60)?.token).toBe(segundoToken);
        expect(mocks.eliminarConfiguracion).not.toHaveBeenCalled();
        continuarSegunda();
        await segunda;
        expect(mocks.leer(101)?.fechaUltimaActualizacion.toString()).toBe("2026-10-09");
        expect(mocks.reserva(60)).toBeNull();
    });

    it("rechaza una escritura después del vencimiento aunque nadie haya tomado la reserva", async () => {
        mocks.fijarRelojBase(0);
        await expect(conBloqueoActualizacion(60, async (almacen) => {
            mocks.fijarRelojBase(360_000);
            await almacen.guardar(estado());
        })).rejects.toThrow("venció o fue reemplazada");

        expect(mocks.creaciones).not.toHaveBeenCalled();
        expect(mocks.reserva(60)).toBeNull();
    });

    it("limita la espera de una reserva ajena sin escribir ni liberar su token", async () => {
        vi.useFakeTimers();
        mocks.fijarRelojBase(0);
        mocks.sembrarReserva(60, { token: "otra-instancia", venceEn: 1_000_000 });
        const trabajo = vi.fn(async () => undefined);
        const pendiente = conBloqueoActualizacion(60, trabajo);
        const rechazo = expect(pendiente).rejects.toThrow("Otra solicitud sigue actualizando");

        await vi.advanceTimersByTimeAsync(380_000);
        await rechazo;

        expect(trabajo).not.toHaveBeenCalled();
        expect(mocks.transaccionesActivas()).toBe(0);
        expect(mocks.creaciones).not.toHaveBeenCalled();
        expect(mocks.eliminarConfiguracion).not.toHaveBeenCalled();
        expect(mocks.reserva(60)?.token).toBe("otra-instancia");
        expect(vi.getTimerCount()).toBe(0);
    });

    it("un fallo remoto libera la reserva y permite reintentar sin modificar el histórico anterior", async () => {
        mocks.sembrar(registro());
        const anterior = await leerHistorico(60);
        await expect(conBloqueoActualizacion(60, async () => { throw new Error("Fallo remoto"); }))
            .rejects.toThrow("Fallo remoto");

        expect(await leerHistorico(60)).toEqual(anterior);
        expect(mocks.reserva(60)).toBeNull();
        expect(mocks.transaccionesActivas()).toBe(0);
        await guardarConBloqueo(estado("2026-10-09"));
        expect(mocks.leer(101)?.fechaUltimaActualizacion.toString()).toBe("2026-10-09");
    });

    it("revierte una escritura fallida y libera la reserva para el siguiente intento", async () => {
        mocks.creaciones.mockImplementationOnce(async (valores) => {
            mocks.sembrar(valores);
            throw new Error("Fallo al guardar");
        });
        await expect(guardarConBloqueo(estado())).rejects.toThrow("Fallo al guardar");

        expect(mocks.ids()).toEqual([]);
        expect(mocks.reserva(60)).toBeNull();
        await guardarConBloqueo(estado("2026-10-09"));
        expect(mocks.ids()).toEqual([101]);
    });

    it("un fallo al liberar no oculta el resultado guardado y la reserva remanente se recupera al vencer", async () => {
        mocks.fijarRelojBase(0);
        mocks.eliminarConfiguracion.mockRejectedValueOnce(new Error("Base temporalmente indisponible"));

        await expect(guardarConBloqueo(estado())).resolves.toBeUndefined();

        expect(mocks.ids()).toEqual([101]);
        expect(mocks.reserva(60)).not.toBeNull();
        mocks.fijarRelojBase(360_000);
        await guardarConBloqueo(estado("2026-10-09"));
        expect(mocks.reserva(60)).toBeNull();
    });

    it("rechaza guardar una especie diferente de la reservada antes de escribir", async () => {
        await expect(conBloqueoActualizacion(60, async (almacen) => {
            await almacen.guardar(estado("2026-10-08", 61));
        })).rejects.toThrow("especie bloqueada");

        expect(mocks.ids()).toEqual([]);
        expect(mocks.creaciones).not.toHaveBeenCalled();
        expect(mocks.actualizaciones).not.toHaveBeenCalled();
        expect(mocks.lecturasEspecies).toHaveBeenCalledOnce();
        expect(mocks.reserva(60)).toBeNull();
    });

    it("rechaza una especie no registrada antes de crear una reserva o ejecutar el trabajo", async () => {
        const trabajo = vi.fn(async () => "registrada");
        await expect(conBloqueoActualizacion(999, trabajo)).rejects.toThrow("La especie no está registrada en la base de datos.");

        expect(trabajo).not.toHaveBeenCalled();
        expect(mocks.lecturasEspecies).toHaveBeenCalledWith({ uamId: 999 }, ["id"]);
        expect(mocks.lecturas).not.toHaveBeenCalled();
        expect(mocks.crearConfiguracion).not.toHaveBeenCalled();
        expect(mocks.transaccionesActivas()).toBe(0);
        mocks.registrarEspecie(301, 999);
        await expect(conBloqueoActualizacion(999, trabajo)).resolves.toBe("registrada");
        expect(trabajo).toHaveBeenCalledOnce();
    });
});
