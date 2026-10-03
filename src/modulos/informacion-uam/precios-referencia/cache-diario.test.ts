import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultaPreciosReferencia } from "./consultas-precios-referencia";
import type { EstadoCacheDiaria } from "./politica-cache-diaria";
import { obtenerConsultaDiariaWebservice } from "./cache-diario";

const {
    base,
    consultar,
    lecturas,
    listados,
    transacciones,
    bloqueos,
    creaciones,
    actualizaciones,
    sembrar,
    leer,
    reiniciar,
} = vi.hoisted(() => {
    type Registro = { id: number; nombreConfiguracion: string; valorConfiguracion: string };
    type Filtro = { nombreConfiguracion?: string; id?: number };
    const registros = new Map<string, Registro>();
    let siguienteId = 1;
    let cola: Promise<void> = Promise.resolve();

    const consultar = vi.fn<(_opciones: { baseUrl: string; token: string }) => Promise<ConsultaPreciosReferencia>>();
    const lecturas = vi.fn(async (filtro: Filtro): Promise<Registro | null> => {
        const registro = filtro.nombreConfiguracion
            ? registros.get(filtro.nombreConfiguracion)
            : [...registros.values()].find((valor) => valor.id === filtro.id);
        return registro ? { ...registro } : null;
    });
    const listados = vi.fn(async (): Promise<Registro[]> => [...registros.values()].map((registro) => ({ ...registro })));
    const creaciones = vi.fn(async (valores: Omit<Registro, "id">) => {
        if (registros.has(valores.nombreConfiguracion)) throw new Error("Registro duplicado en el mock");
        registros.set(valores.nombreConfiguracion, { id: siguienteId++, ...valores });
    });
    const actualizaciones = vi.fn(async (filtro: Filtro, valores: Pick<Registro, "valorConfiguracion">) => {
        const registro = [...registros.values()].find((valor) => valor.id === filtro.id);
        if (!registro) throw new Error("Registro inexistente en el mock");
        registro.valorConfiguracion = valores.valorConfiguracion;
    });
    const bloqueos = vi.fn(async () => undefined);
    const tabla = {
        all: listados,
        where: (filtro: Filtro) => ({
            first: () => lecturas(filtro),
            update: (valores: Pick<Registro, "valorConfiguracion">) => actualizaciones(filtro, valores),
        }),
        create: creaciones,
    };
    const tx = { orm: { public: { Configuracion: tabla } }, execute: bloqueos };

    // Serializa las transacciones para representar la espera del advisory lock entre solicitudes.
    const transacciones = vi.fn(async (trabajo: (transaccion: typeof tx) => Promise<unknown>) => {
        const anterior = cola;
        let liberar!: () => void;
        cola = new Promise<void>((resolve) => { liberar = resolve; });
        await anterior;
        try {
            return await trabajo(tx);
        } finally {
            liberar();
        }
    });

    return {
        base: {
            orm: { public: { Configuracion: tabla } },
            transaction: transacciones,
            raw: { sql: () => ({ returnsRow: () => ({ build: () => ({}) }) }) },
        },
        consultar,
        lecturas,
        listados,
        transacciones,
        bloqueos,
        creaciones,
        actualizaciones,
        sembrar: (nombre: string, valorConfiguracion: string) => {
            registros.set(nombre, { id: siguienteId++, nombreConfiguracion: nombre, valorConfiguracion });
        },
        leer: (nombre: string) => registros.get(nombre)?.valorConfiguracion ?? null,
        reiniciar: () => {
            registros.clear();
            siguienteId = 1;
            cola = Promise.resolve();
            consultar.mockReset();
            lecturas.mockClear();
            listados.mockClear();
            transacciones.mockClear();
            bloqueos.mockClear();
            creaciones.mockClear();
            actualizaciones.mockClear();
        },
    };
});

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: base }));
vi.mock("./cliente-webservice", () => ({ consultarUltimoRelevamiento: consultar }));

const baseUrl = "https://precios.example.test/servicio";
const nombreConfiguracion = `precios-referencia:latest:${createHash("sha256").update(baseUrl).digest("hex").slice(0, 24)}`;

function dato(fecha: string): ConsultaPreciosReferencia {
    return {
        survey_date: fecha,
        types: [{
            classification_id: 1,
            classification: "Hortalizas",
            products: [{
                species_id: 2,
                species: "Acelga",
                varieties: [{
                    variety: "Común",
                    presentations: [{
                        caliber: "Mediano",
                        country: "Uruguay",
                        measure_unit: "Docena",
                        prices: [{ category: "I", min_kg: 10, max_kg: 15, min_un: 100, max_un: 150, is_reference: true }],
                    }],
                }],
            }],
        }],
    };
}

function estado(fecha: string, consulta: ConsultaPreciosReferencia | null): EstadoCacheDiaria {
    return { version: 1, ultimoIntento: fecha, ultimoExito: consulta ? fecha : null, consulta };
}

beforeEach(() => {
    reiniciar();
    vi.stubEnv("PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL", baseUrl);
    vi.stubEnv("PRECIOS_REFERENCIA_JWT_TOKEN", "token-de-prueba");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T15:00:00.000Z"));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
});

describe("obtenerConsultaDiariaWebservice", () => {
    it("devuelve un estado válido de hoy con una sola lectura y sin transacción ni consulta remota", async () => {
        const guardado = dato("2026-10-02");
        sembrar(nombreConfiguracion, JSON.stringify(estado("2026-10-02", guardado)));

        await expect(obtenerConsultaDiariaWebservice()).resolves.toEqual(guardado);

        expect(lecturas).toHaveBeenCalledOnce();
        expect(transacciones).not.toHaveBeenCalled();
        expect(bloqueos).not.toHaveBeenCalled();
        expect(consultar).not.toHaveBeenCalled();
    });

    it("reutiliza un fallo ya registrado hoy sin abrir transacción ni repetir la consulta", async () => {
        sembrar(nombreConfiguracion, JSON.stringify(estado("2026-10-02", null)));

        await expect(obtenerConsultaDiariaWebservice()).rejects.toThrow("Todavía no hay un relevamiento");

        expect(lecturas).toHaveBeenCalledOnce();
        expect(transacciones).not.toHaveBeenCalled();
        expect(consultar).not.toHaveBeenCalled();
    });

    it("tras el primer acceso usa la lectura rápida y renueva el dato al día siguiente", async () => {
        const primero = dato("2026-10-02");
        const siguiente = dato("2026-10-03");
        consultar.mockResolvedValueOnce(primero).mockResolvedValueOnce(siguiente);

        await expect(obtenerConsultaDiariaWebservice()).resolves.toEqual(primero);
        expect(JSON.parse(leer(nombreConfiguracion)!)).toEqual(estado("2026-10-02", primero));
        expect(transacciones).toHaveBeenCalledOnce();
        expect(bloqueos).toHaveBeenCalledOnce();
        expect(creaciones).toHaveBeenCalledOnce();

        await expect(obtenerConsultaDiariaWebservice()).resolves.toEqual(primero);
        expect(transacciones).toHaveBeenCalledOnce();
        expect(consultar).toHaveBeenCalledOnce();

        vi.setSystemTime(new Date("2026-10-03T15:00:00.000Z"));
        await expect(obtenerConsultaDiariaWebservice()).resolves.toEqual(siguiente);
        expect(JSON.parse(leer(nombreConfiguracion)!)).toEqual(estado("2026-10-03", siguiente));
        expect(transacciones).toHaveBeenCalledTimes(2);
        expect(bloqueos).toHaveBeenCalledTimes(2);
        expect(consultar).toHaveBeenCalledTimes(2);
        expect(actualizaciones).toHaveBeenCalledOnce();
    });

    it("relee bajo el bloqueo y hace una sola consulta remota para dos misses simultáneos", async () => {
        const guardado = dato("2026-10-02");
        consultar.mockResolvedValue(guardado);

        const resultados = await Promise.all([obtenerConsultaDiariaWebservice(), obtenerConsultaDiariaWebservice()]);

        expect(resultados).toEqual([guardado, guardado]);
        expect(transacciones).toHaveBeenCalledTimes(2);
        expect(bloqueos).toHaveBeenCalledTimes(2);
        expect(lecturas).toHaveBeenCalledTimes(4);
        expect(consultar).toHaveBeenCalledOnce();
        expect(creaciones).toHaveBeenCalledOnce();
        expect(actualizaciones).not.toHaveBeenCalled();
    });

    it("registra un fallo inicial y evita nuevos intentos durante el mismo día", async () => {
        consultar.mockRejectedValue(new Error("Servicio no disponible"));

        await expect(obtenerConsultaDiariaWebservice()).rejects.toThrow("Todavía no hay un relevamiento");
        expect(JSON.parse(leer(nombreConfiguracion)!)).toEqual(estado("2026-10-02", null));
        await expect(obtenerConsultaDiariaWebservice()).rejects.toThrow("Todavía no hay un relevamiento");

        expect(transacciones).toHaveBeenCalledOnce();
        expect(consultar).toHaveBeenCalledOnce();
        expect(creaciones).toHaveBeenCalledOnce();
    });

    it("conserva el último dato válido si falla la renovación y usa ese dato el resto del día", async () => {
        const anterior = dato("2026-10-01");
        sembrar(nombreConfiguracion, JSON.stringify(estado("2026-10-01", anterior)));
        consultar.mockRejectedValue(new Error("Servicio no disponible"));

        await expect(obtenerConsultaDiariaWebservice()).resolves.toEqual(anterior);
        await expect(obtenerConsultaDiariaWebservice()).resolves.toEqual(anterior);

        expect(JSON.parse(leer(nombreConfiguracion)!)).toEqual({
            version: 1,
            ultimoIntento: "2026-10-02",
            ultimoExito: "2026-10-01",
            consulta: anterior,
        });
        expect(transacciones).toHaveBeenCalledOnce();
        expect(consultar).toHaveBeenCalledOnce();
    });

    it("rescata el relevamiento más reciente de otra fila si falla la primera consulta de la fuente actual", async () => {
        const anterior = dato("2026-09-30");
        const ultimo = dato("2026-10-01");
        sembrar("precios-referencia:latest:fuente-antigua", JSON.stringify(estado("2026-10-01", anterior)));
        sembrar("incremento_precio", "10");
        sembrar("precios-referencia:latest:fuente-reciente", JSON.stringify(estado("2026-10-01", ultimo)));
        consultar.mockRejectedValue(new Error("Servicio no disponible"));

        await expect(obtenerConsultaDiariaWebservice()).resolves.toEqual(ultimo);
        await expect(obtenerConsultaDiariaWebservice()).resolves.toEqual(ultimo);

        expect(JSON.parse(leer(nombreConfiguracion)!)).toEqual({
            version: 1,
            ultimoIntento: "2026-10-02",
            ultimoExito: "2026-10-01",
            consulta: ultimo,
        });
        expect(consultar).toHaveBeenCalledOnce();
        expect(listados).toHaveBeenCalledOnce();
    });

    it("prefiere un relevamiento más nuevo de otra fila e ignora los registros inválidos", async () => {
        const anterior = dato("2026-09-30");
        const ultimo = dato("2026-10-01");
        sembrar(nombreConfiguracion, JSON.stringify(estado("2026-10-01", anterior)));
        sembrar("precios-referencia:latest:registro-invalido", "{");
        sembrar("precios-referencia:latest:otra-fuente", JSON.stringify(estado("2026-10-01", ultimo)));
        consultar.mockRejectedValue(new Error("Servicio no disponible"));

        await expect(obtenerConsultaDiariaWebservice()).resolves.toEqual(ultimo);

        expect(JSON.parse(leer(nombreConfiguracion)!)).toEqual({
            version: 1,
            ultimoIntento: "2026-10-02",
            ultimoExito: "2026-10-01",
            consulta: ultimo,
        });
        expect(consultar).toHaveBeenCalledOnce();
    });

    it("rescata otra fila si la fuente actual ya registró un fallo hoy sin datos", async () => {
        const ultimo = dato("2026-10-01");
        sembrar(nombreConfiguracion, JSON.stringify(estado("2026-10-02", null)));
        sembrar("precios-referencia:latest:otra-fuente", JSON.stringify(estado("2026-10-01", ultimo)));

        await expect(obtenerConsultaDiariaWebservice()).resolves.toEqual(ultimo);
        await expect(obtenerConsultaDiariaWebservice()).resolves.toEqual(ultimo);

        expect(JSON.parse(leer(nombreConfiguracion)!)).toEqual({
            version: 1,
            ultimoIntento: "2026-10-02",
            ultimoExito: "2026-10-01",
            consulta: ultimo,
        });
        expect(consultar).not.toHaveBeenCalled();
        expect(actualizaciones).toHaveBeenCalledOnce();
        expect(listados).toHaveBeenCalledTimes(2);
    });

    it("descarta un JSON inválido aunque diga que hubo un intento hoy", async () => {
        sembrar(nombreConfiguracion, JSON.stringify({ version: 1, ultimoIntento: "2026-10-02", ultimoExito: null, consulta: {} }));
        const guardado = dato("2026-10-02");
        consultar.mockResolvedValue(guardado);

        await expect(obtenerConsultaDiariaWebservice()).resolves.toEqual(guardado);

        expect(transacciones).toHaveBeenCalledOnce();
        expect(consultar).toHaveBeenCalledOnce();
        expect(actualizaciones).toHaveBeenCalledOnce();
        expect(JSON.parse(leer(nombreConfiguracion)!)).toEqual(estado("2026-10-02", guardado));
    });

    it("recalcula el día al terminar la espera del bloqueo", async () => {
        vi.setSystemTime(new Date("2026-10-03T02:59:00.000Z")); // 2 de octubre, 23:59 en Montevideo.
        const viernes = dato("2026-10-02");
        const sabado = dato("2026-10-03");
        let entregarPrimera!: (consulta: ConsultaPreciosReferencia) => void;
        let avisarInicio!: () => void;
        const inicio = new Promise<void>((resolve) => { avisarInicio = resolve; });
        consultar.mockImplementationOnce(() => new Promise<ConsultaPreciosReferencia>((resolve) => {
            entregarPrimera = resolve;
            avisarInicio();
        })).mockResolvedValueOnce(sabado);

        const primera = obtenerConsultaDiariaWebservice();
        await inicio;
        const segunda = obtenerConsultaDiariaWebservice();
        await vi.waitFor(() => expect(transacciones).toHaveBeenCalledTimes(2));

        vi.setSystemTime(new Date("2026-10-03T03:00:01.000Z")); // 3 de octubre, 00:00 en Montevideo.
        entregarPrimera(viernes);

        await expect(primera).resolves.toEqual(viernes);
        await expect(segunda).resolves.toEqual(sabado);
        expect(consultar).toHaveBeenCalledTimes(2);
        expect(JSON.parse(leer(nombreConfiguracion)!)).toEqual(estado("2026-10-03", sabado));
    });
});
