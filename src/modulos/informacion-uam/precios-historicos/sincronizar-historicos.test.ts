import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EstadoHistorico } from "./almacen-historicos";
import type { ConsultaHistorica } from "./parametros-consulta";
import { actualizarHistoricoEspecie, fechaInicioImportacion } from "./sincronizar-historicos";
import type { HistoricoProducto } from "./tipos";
import { fusionarHistoricos } from "./transformar-historico";

const mocks = vi.hoisted(() => ({
    consultar: vi.fn(),
    leer: vi.fn(),
    guardar: vi.fn(),
    bloquear: vi.fn(),
}));

vi.mock("./almacen-historicos", () => ({ conBloqueoActualizacion: mocks.bloquear, leerHistorico: mocks.leer }));
vi.mock("./cliente-webservice", () => ({ consultarHistorico: mocks.consultar }));

const baseUrl = "https://precios.example.test/servicio";
const hoy = "2026-10-09";
const estados = new Map<number, EstadoHistorico>();

type Contexto = {
    leer: () => Promise<EstadoHistorico | null>;
    guardar: (estado: EstadoHistorico) => Promise<void>;
};

function respuesta(consulta: ConsultaHistorica): HistoricoProducto {
    return {
        classification_id: 1, classification: "Frutas", species_id: consulta.speciesId,
        species: "Especie " + consulta.speciesId, from: consulta.desde, to: consulta.hasta, series: [],
    };
}

function sembrar(speciesId: number, fechaUltimaActualizacion: string): EstadoHistorico {
    const estado: EstadoHistorico = {
        fechaUltimaActualizacion,
        historico: respuesta({ speciesId, desde: "2023-10-09", hasta: fechaUltimaActualizacion }),
    };
    estados.set(speciesId, estado);
    return estado;
}

function contexto(speciesId: number): Contexto {
    return {
        leer: () => mocks.leer(speciesId),
        guardar: (estado) => mocks.guardar(estado),
    };
}

beforeEach(() => {
    vi.resetAllMocks();
    estados.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T15:00:00Z"));
    vi.stubEnv("PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL", baseUrl);
    vi.stubEnv("PRECIOS_REFERENCIA_JWT_TOKEN", "token-de-prueba");
    mocks.leer.mockImplementation(async (speciesId: number) => estados.get(speciesId) ?? null);
    mocks.guardar.mockImplementation(async (estado: EstadoHistorico) => {
        const speciesId = estado.historico.species_id;
        const anterior = estados.get(speciesId);
        estados.set(speciesId, anterior ? {
            historico: fusionarHistoricos(anterior.historico, estado.historico),
            fechaUltimaActualizacion: anterior.fechaUltimaActualizacion > estado.fechaUltimaActualizacion
                ? anterior.fechaUltimaActualizacion : estado.fechaUltimaActualizacion,
        } : estado);
    });
    mocks.bloquear.mockImplementation(async (speciesId: number, trabajo: (datos: Contexto) => Promise<boolean>) => {
        return await trabajo(contexto(speciesId));
    });
    mocks.consultar.mockImplementation(async (_opciones: unknown, consulta: ConsultaHistorica) => respuesta(consulta));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
});

describe("período inicial", () => {
    it("consulta nueve años cuando la especie todavía no tiene histórico", () => {
        expect(fechaInicioImportacion(hoy)).toBe("2017-10-09");
    });

    it("ajusta el 29 de febrero cuando el año inicial no es bisiesto", () => {
        expect(fechaInicioImportacion("2024-02-29")).toBe("2015-02-28");
    });
});

describe("actualizarHistoricoEspecie", () => {
    it("consulta solamente la especie seleccionada desde su última actualización hasta hoy", async () => {
        sembrar(10, "2026-10-01");
        const otra = sembrar(20, "2026-10-08");

        await expect(actualizarHistoricoEspecie(10)).resolves.toBeUndefined();

        expect(mocks.consultar).toHaveBeenCalledExactlyOnceWith(
            { baseUrl, token: "token-de-prueba" },
            { speciesId: 10, desde: "2026-10-01", hasta: hoy },
        );
        expect(mocks.bloquear).toHaveBeenCalledExactlyOnceWith(10, expect.any(Function));
        expect(mocks.leer.mock.calls.every(([speciesId]) => speciesId === 10)).toBe(true);
        expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith({
            fechaUltimaActualizacion: hoy,
            historico: respuesta({ speciesId: 10, desde: "2026-10-01", hasta: hoy }),
        });
        expect(estados.get(20)).toBe(otra);
    });

    it("crea el histórico inicial de nueve años con tres consultas de hasta tres años y una sola escritura", async () => {
        const anterior = respuesta({ speciesId: 10, desde: "2017-10-09", hasta: "2020-10-09" });
        const intermedio = respuesta({ speciesId: 10, desde: "2020-10-10", hasta: "2023-10-09" });
        const reciente = respuesta({ speciesId: 10, desde: "2023-10-10", hasta: hoy });
        anterior.series = [{ date: "2017-10-09", volume_kg: 125, presentations: [] }];
        intermedio.series = [{ date: "2020-10-10", volume_kg: 200, presentations: [] }];
        reciente.series = [{ date: hoy, volume_kg: 250, presentations: [] }];
        const originales = structuredClone([anterior, intermedio, reciente]);
        mocks.consultar.mockResolvedValueOnce(anterior).mockResolvedValueOnce(intermedio).mockResolvedValueOnce(reciente);

        await actualizarHistoricoEspecie(10);

        expect(mocks.consultar.mock.calls).toEqual([
            [{ baseUrl, token: "token-de-prueba" }, { speciesId: 10, desde: "2017-10-09", hasta: "2020-10-09" }],
            [{ baseUrl, token: "token-de-prueba" }, { speciesId: 10, desde: "2020-10-10", hasta: "2023-10-09" }],
            [{ baseUrl, token: "token-de-prueba" }, { speciesId: 10, desde: "2023-10-10", hasta: hoy }],
        ]);
        expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith({
            fechaUltimaActualizacion: hoy,
            historico: { ...anterior, to: hoy, series: [...anterior.series, ...intermedio.series, ...reciente.series] },
        });
        expect([anterior, intermedio, reciente]).toStrictEqual(originales);
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
        expect(estados.size).toBe(1);
    });

    it("cubre el 29 de febrero sin dejar huecos ni pedir más de tres años en un tramo", async () => {
        vi.setSystemTime(new Date("2024-02-29T15:00:00Z"));

        await actualizarHistoricoEspecie(10);

        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta)).toEqual([
            { speciesId: 10, desde: "2015-02-28", hasta: "2018-02-28" },
            { speciesId: 10, desde: "2018-03-01", hasta: "2021-02-28" },
            { speciesId: 10, desde: "2021-03-01", hasta: "2024-02-29" },
        ]);
        expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith({
            fechaUltimaActualizacion: "2024-02-29",
            historico: respuesta({ speciesId: 10, desde: "2015-02-28", hasta: "2024-02-29" }),
        });
    });

    it("las visitas simultáneas comparten los tres pedidos iniciales y esperan todos antes de guardar", async () => {
        let entregarAnterior!: (historico: HistoricoProducto) => void;
        let entregarIntermedio!: (historico: HistoricoProducto) => void;
        let entregarReciente!: (historico: HistoricoProducto) => void;
        const pendienteAnterior = new Promise<HistoricoProducto>((resolve) => { entregarAnterior = resolve; });
        const pendienteIntermedio = new Promise<HistoricoProducto>((resolve) => { entregarIntermedio = resolve; });
        const pendienteReciente = new Promise<HistoricoProducto>((resolve) => { entregarReciente = resolve; });
        mocks.consultar.mockReturnValueOnce(pendienteAnterior).mockReturnValueOnce(pendienteIntermedio).mockReturnValueOnce(pendienteReciente);
        const solicitudes = Array.from({ length: 10 }, () => actualizarHistoricoEspecie(10));
        const anterior = respuesta({ speciesId: 10, desde: "2017-10-09", hasta: "2020-10-09" });
        const intermedio = respuesta({ speciesId: 10, desde: "2020-10-10", hasta: "2023-10-09" });
        const reciente = respuesta({ speciesId: 10, desde: "2023-10-10", hasta: hoy });

        try {
            expect(new Set(solicitudes).size).toBe(1);
            await vi.advanceTimersByTimeAsync(0);
            expect(mocks.consultar).toHaveBeenCalledTimes(3);
            expect(mocks.guardar).not.toHaveBeenCalled();

            entregarAnterior(anterior);
            await vi.advanceTimersByTimeAsync(0);
            expect(mocks.guardar).not.toHaveBeenCalled();
            expect(estados.has(10)).toBe(false);

            entregarIntermedio(intermedio);
            await vi.advanceTimersByTimeAsync(0);
            expect(mocks.guardar).not.toHaveBeenCalled();
            expect(estados.has(10)).toBe(false);

            entregarReciente(reciente);
            await expect(Promise.all(solicitudes)).resolves.toEqual(Array(10).fill(undefined));
        } finally {
            entregarAnterior(anterior);
            entregarIntermedio(intermedio);
            entregarReciente(reciente);
            await Promise.allSettled(solicitudes);
        }

        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(mocks.bloquear).toHaveBeenCalledOnce();
        expect(estados.get(10)?.historico.from).toBe("2017-10-09");
        expect(estados.get(10)?.historico.to).toBe(hoy);
    });

    it("mantiene compartida la carga inicial si falla un tramo mientras otro sigue pendiente", async () => {
        const fallo = new Error("El primer tramo no está disponible.");
        let rechazarAnterior!: (error: Error) => void;
        let entregarReciente!: (historico: HistoricoProducto) => void;
        const pendienteAnterior = new Promise<HistoricoProducto>((_resolve, reject) => { rechazarAnterior = reject; });
        const pendienteReciente = new Promise<HistoricoProducto>((resolve) => { entregarReciente = resolve; });
        mocks.consultar.mockReturnValueOnce(pendienteAnterior)
            .mockResolvedValueOnce(respuesta({ speciesId: 10, desde: "2020-10-10", hasta: "2023-10-09" }))
            .mockReturnValueOnce(pendienteReciente);
        const primera = actualizarHistoricoEspecie(10);
        const resultado = primera.then(() => undefined, (error: unknown) => error);
        let segunda: Promise<void> | undefined;
        const reciente = respuesta({ speciesId: 10, desde: "2023-10-10", hasta: hoy });

        try {
            await vi.advanceTimersByTimeAsync(0);
            rechazarAnterior(fallo);
            await vi.advanceTimersByTimeAsync(0);

            segunda = actualizarHistoricoEspecie(10);
            expect(segunda).toBe(primera);
            expect(mocks.consultar).toHaveBeenCalledTimes(3);
            expect(mocks.bloquear).toHaveBeenCalledOnce();
            expect(mocks.guardar).not.toHaveBeenCalled();

            entregarReciente(reciente);
            await expect(resultado).resolves.toBe(fallo);
            await expect(segunda).rejects.toBe(fallo);
        } finally {
            rechazarAnterior(fallo);
            entregarReciente(reciente);
            await Promise.allSettled(segunda ? [primera, segunda] : [primera]);
        }

        expect(estados.has(10)).toBe(false);
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("diez solicitudes simultáneas de la misma especie comparten un pedido y una escritura", async () => {
        sembrar(10, "2026-10-08");
        let entregar!: (historico: HistoricoProducto) => void;
        const pendiente = new Promise<HistoricoProducto>((resolve) => { entregar = resolve; });
        mocks.consultar.mockReturnValueOnce(pendiente);
        const solicitudes = Array.from({ length: 10 }, () => actualizarHistoricoEspecie(10));

        try {
            expect(new Set(solicitudes).size).toBe(1);
            await vi.advanceTimersByTimeAsync(0);
            expect(mocks.consultar).toHaveBeenCalledOnce();
            expect(mocks.guardar).not.toHaveBeenCalled();
            entregar(respuesta({ speciesId: 10, desde: "2026-10-08", hasta: hoy }));
            await expect(Promise.all(solicitudes)).resolves.toEqual(Array(10).fill(undefined));
        } finally {
            entregar(respuesta({ speciesId: 10, desde: "2026-10-08", hasta: hoy }));
            await Promise.allSettled(solicitudes);
        }

        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(mocks.bloquear).toHaveBeenCalledOnce();
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
    });

    it("dos especies distintas consultan solamente sus propios identificadores y períodos", async () => {
        sembrar(10, "2026-10-01");
        sembrar(20, "2026-10-08");
        const otra = sembrar(30, "2026-10-07");

        await Promise.all([actualizarHistoricoEspecie(10), actualizarHistoricoEspecie(20)]);

        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta)).toEqual(expect.arrayContaining([
            { speciesId: 10, desde: "2026-10-01", hasta: hoy },
            { speciesId: 20, desde: "2026-10-08", hasta: hoy },
        ]));
        expect(mocks.consultar).toHaveBeenCalledTimes(2);
        expect(mocks.guardar).toHaveBeenCalledTimes(2);
        expect(estados.get(30)).toBe(otra);
    });

    it("una visita después de medianoche no comparte el pedido del día anterior y relee bajo el bloqueo", async () => {
        sembrar(10, "2026-10-08");
        vi.setSystemTime(new Date("2026-10-10T02:59:59Z"));
        let entregar!: (historico: HistoricoProducto) => void;
        const respuestaPendiente = new Promise<HistoricoProducto>((resolve) => { entregar = resolve; });
        mocks.consultar.mockReturnValueOnce(respuestaPendiente);
        let cola: Promise<void> = Promise.resolve();
        mocks.bloquear.mockImplementation(async (speciesId: number, trabajo: (datos: Contexto) => Promise<boolean>) => {
            const anterior = cola;
            let liberar!: () => void;
            cola = new Promise<void>((resolve) => { liberar = resolve; });
            await anterior;
            try {
                return await trabajo(contexto(speciesId));
            } finally {
                liberar();
            }
        });
        const primera = actualizarHistoricoEspecie(10);
        let segunda: Promise<void> | undefined;
        const respuestaAnterior = respuesta({ speciesId: 10, desde: "2026-10-08", hasta: "2026-10-09" });

        try {
            await vi.advanceTimersByTimeAsync(0);
            expect(mocks.consultar).toHaveBeenCalledOnce();
            vi.setSystemTime(new Date("2026-10-10T03:00:01Z"));
            segunda = actualizarHistoricoEspecie(10);
            await vi.advanceTimersByTimeAsync(0);

            expect(segunda).not.toBe(primera);
            expect(mocks.bloquear).toHaveBeenCalledTimes(2);
            expect(mocks.consultar).toHaveBeenCalledOnce();
            entregar(respuestaAnterior);
            await Promise.all([primera, segunda]);
        } finally {
            entregar(respuestaAnterior);
            await Promise.allSettled(segunda ? [primera, segunda] : [primera]);
        }

        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta)).toEqual([
            { speciesId: 10, desde: "2026-10-08", hasta: "2026-10-09" },
            { speciesId: 10, desde: "2026-10-09", hasta: "2026-10-10" },
        ]);
        expect(mocks.guardar.mock.calls.map(([guardado]) => guardado.fechaUltimaActualizacion))
            .toEqual(["2026-10-09", "2026-10-10"]);
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe("2026-10-10");
    });

    it.each([hoy, "2026-10-10"])("no consulta ni exige configuración del webservice si la fecha guardada es %s", async (fecha) => {
        const guardado = sembrar(10, fecha);
        vi.stubEnv("PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL", undefined);
        vi.stubEnv("PRECIOS_REFERENCIA_JWT_TOKEN", undefined);

        await expect(actualizarHistoricoEspecie(10)).resolves.toBeUndefined();

        expect(mocks.consultar).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.bloquear).not.toHaveBeenCalled();
        expect(estados.get(10)).toBe(guardado);
    });

    it("relee dentro del bloqueo y omite el pedido si otra instancia ya actualizó la especie", async () => {
        sembrar(10, "2026-10-08");
        mocks.bloquear.mockImplementation(async (speciesId: number, trabajo: (datos: Contexto) => Promise<boolean>) => {
            sembrar(speciesId, hoy);
            return await trabajo(contexto(speciesId));
        });

        await actualizarHistoricoEspecie(10);

        expect(mocks.consultar).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.leer).toHaveBeenCalledWith(10);
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
    });

    it("delega el documento crudo al almacén sin cambiar precios, atributos ni fechas inesperadas", async () => {
        const previo = sembrar(10, "2026-10-08");
        const originalPrevio = structuredClone(previo);
        const recibido = respuesta({ speciesId: 10, desde: "2026-10-08", hasta: hoy });
        recibido.series = [{
            date: null, volume_kg: "Ñ",
            presentations: [{
                variety: { nombre: "Especial" }, caliber: false, country: ["URUGUAY"], measure_unit: null,
                prices: [{ category: { codigo: "I" }, min_kg: "Ñ", max_kg: null, min_un: 100, max_un: 75, is_reference: [] }],
            }],
        }];
        const original = structuredClone(recibido);
        mocks.consultar.mockResolvedValue(recibido);

        await actualizarHistoricoEspecie(10);

        expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith({ fechaUltimaActualizacion: hoy, historico: original });
        expect(recibido).toStrictEqual(original);
        expect(previo).toStrictEqual(originalPrevio);
    });

    it("una respuesta vacía con cobertura completa avanza la fecha de verificación", async () => {
        sembrar(10, "2026-10-08");

        await actualizarHistoricoEspecie(10);

        expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith({
            fechaUltimaActualizacion: hoy,
            historico: respuesta({ speciesId: 10, desde: "2026-10-08", hasta: hoy }),
        });
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
    });

    it("un fallo remoto mantiene disponible el histórico guardado sin adelantar la fecha", async () => {
        const guardado = sembrar(10, "2026-10-08");
        const original = structuredClone(guardado);
        mocks.consultar.mockRejectedValueOnce(new Error("El webservice respondió con estado 503."));

        await expect(actualizarHistoricoEspecie(10)).resolves.toBeUndefined();

        expect(estados.get(10)).toBe(guardado);
        expect(guardado).toStrictEqual(original);
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("mantiene disponible el histórico anterior si no puede obtener la reserva de actualización", async () => {
        const guardado = sembrar(10, "2026-10-08");
        mocks.bloquear.mockRejectedValueOnce(new Error("Otra solicitud sigue actualizando el histórico."));

        await expect(actualizarHistoricoEspecie(10)).resolves.toBeUndefined();

        expect(estados.get(10)).toBe(guardado);
        expect(mocks.consultar).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("propaga el fallo de reserva cuando todavía no hay un histórico guardado", async () => {
        const fallo = new Error("Otra solicitud sigue actualizando el histórico.");
        mocks.bloquear.mockRejectedValueOnce(fallo);

        await expect(actualizarHistoricoEspecie(10)).rejects.toBe(fallo);

        expect(mocks.consultar).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it.each([0, 1, 2])("un fallo del tramo inicial %i se propaga sin guardar información incompleta", async (tramoFallido) => {
        const fallo = new Error("El webservice respondió con estado 503.");
        let tramo = 0;
        mocks.consultar.mockImplementation(async (_opciones: unknown, consulta: ConsultaHistorica) => {
            if (tramo++ === tramoFallido) throw fallo;
            return respuesta(consulta);
        });

        await expect(actualizarHistoricoEspecie(10)).rejects.toBe(fallo);

        expect(mocks.consultar).toHaveBeenCalledTimes(3);
        expect(estados.has(10)).toBe(false);
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it.each([0, 1, 2])("una cobertura incompleta del tramo inicial %i impide guardar los nueve años", async (tramoIncompleto) => {
        let tramo = 0;
        mocks.consultar.mockImplementation(async (_opciones: unknown, consulta: ConsultaHistorica) => {
            return respuesta(tramo++ === tramoIncompleto ? { ...consulta, desde: consulta.hasta } : consulta);
        });

        await expect(actualizarHistoricoEspecie(10)).rejects.toThrow("cobertura completa");

        expect(mocks.consultar).toHaveBeenCalledTimes(3);
        expect(estados.has(10)).toBe(false);
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("un fallo al guardar mantiene el histórico anterior disponible y su fecha pendiente", async () => {
        const guardado = sembrar(10, "2026-10-08");
        const original = structuredClone(guardado);
        mocks.guardar.mockRejectedValueOnce(new Error("No se pudo guardar el histórico."));

        await expect(actualizarHistoricoEspecie(10)).resolves.toBeUndefined();

        expect(estados.get(10)).toBe(guardado);
        expect(guardado).toStrictEqual(original);
    });

    it("una cobertura parcial conserva el histórico anterior y no adelanta la actualización", async () => {
        const guardado = sembrar(10, "2026-10-08");
        mocks.consultar.mockResolvedValueOnce(respuesta({ speciesId: 10, desde: hoy, hasta: hoy }));

        await expect(actualizarHistoricoEspecie(10)).resolves.toBeUndefined();

        expect(estados.get(10)).toBe(guardado);
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("la visita siguiente reintenta una actualización fallida desde la misma fecha pendiente", async () => {
        sembrar(10, "2026-10-08");
        mocks.consultar.mockRejectedValueOnce(new Error("El webservice no está disponible."));

        await actualizarHistoricoEspecie(10);
        await actualizarHistoricoEspecie(10);

        expect(mocks.consultar).toHaveBeenCalledTimes(2);
        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta)).toEqual([
            { speciesId: 10, desde: "2026-10-08", hasta: hoy },
            { speciesId: 10, desde: "2026-10-08", hasta: hoy },
        ]);
        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
    });

    it("reintenta los tres tramos de la carga inicial después de un fallo y conserva el período de nueve años", async () => {
        mocks.consultar.mockRejectedValueOnce(new Error("El webservice no está disponible."));
        await expect(actualizarHistoricoEspecie(10)).rejects.toThrow("no está disponible");

        await actualizarHistoricoEspecie(10);

        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta)).toEqual([
            { speciesId: 10, desde: "2017-10-09", hasta: "2020-10-09" },
            { speciesId: 10, desde: "2020-10-10", hasta: "2023-10-09" },
            { speciesId: 10, desde: "2023-10-10", hasta: hoy },
            { speciesId: 10, desde: "2017-10-09", hasta: "2020-10-09" },
            { speciesId: 10, desde: "2020-10-10", hasta: "2023-10-09" },
            { speciesId: 10, desde: "2023-10-10", hasta: hoy },
        ]);
        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(estados.get(10)?.historico.from).toBe("2017-10-09");
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
    });

    it("usa la fecha de Montevideo aunque UTC ya esté en el día siguiente", async () => {
        vi.setSystemTime(new Date("2026-10-10T01:30:00Z"));
        sembrar(10, "2026-10-08");

        await actualizarHistoricoEspecie(10);

        expect(mocks.consultar).toHaveBeenCalledWith(expect.anything(), { speciesId: 10, desde: "2026-10-08", hasta: hoy });
    });
});

describe("ampliación de la cobertura histórica", () => {
    it("divide una actualización atrasada más de tres años y conserva la cobertura anterior", async () => {
        const guardado = sembrar(10, "2020-10-09");
        guardado.historico.from = "2017-10-09";

        await actualizarHistoricoEspecie(10);

        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta)).toEqual([
            { speciesId: 10, desde: "2020-10-09", hasta: "2023-10-09" },
            { speciesId: 10, desde: "2023-10-10", hasta: hoy },
        ]);
        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(estados.get(10)?.historico.from).toBe("2017-10-09");
        expect(estados.get(10)?.historico.to).toBe(hoy);
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
    });

    it("avanza la última actualización solamente hasta el lote completado si falla el siguiente", async () => {
        const guardado = sembrar(10, "2014-10-09");
        guardado.historico.from = "2011-10-09";
        let cantidadConsultas = 0;
        mocks.consultar.mockImplementation(async (_opciones: unknown, consulta: ConsultaHistorica) => {
            if (++cantidadConsultas === 4) throw new Error("Falló el segundo lote.");
            return respuesta(consulta);
        });

        await expect(actualizarHistoricoEspecie(10)).resolves.toBeUndefined();

        expect(mocks.consultar).toHaveBeenCalledTimes(4);
        expect(mocks.bloquear).toHaveBeenCalledTimes(2);
        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe("2023-10-09");
        expect(estados.get(10)?.historico.to).toBe("2023-10-09");
        expect(estados.get(10)?.historico.from).toBe("2011-10-09");
        mocks.consultar.mockClear();

        await actualizarHistoricoEspecie(10);

        expect(mocks.consultar).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
            speciesId: 10, desde: "2023-10-09", hasta: hoy,
        });
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
        expect(estados.get(10)?.historico.from).toBe("2011-10-09");
    });

    it.each([hoy, "2026-10-10"])("descarga fechas anteriores aunque la especie esté actualizada al %s", async (fechaUltimaActualizacion) => {
        const guardado = sembrar(10, fechaUltimaActualizacion);
        guardado.historico.series = [{ date: "2023-10-09", volume_kg: 200, presentations: [] }];
        const original = structuredClone(guardado);
        mocks.consultar.mockImplementation(async (_opciones: unknown, consulta: ConsultaHistorica) => ({
            ...respuesta(consulta),
            series: [{ date: consulta.desde, volume_kg: 125, presentations: [] }],
        }));

        await actualizarHistoricoEspecie(10, "2022-10-09");

        expect(mocks.consultar).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
            speciesId: 10, desde: "2022-10-09", hasta: "2023-10-09",
        });
        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(estados.get(10)).toEqual({
            fechaUltimaActualizacion,
            historico: {
                ...original.historico,
                from: "2022-10-09",
                series: [{ date: "2022-10-09", volume_kg: 125, presentations: [] }, ...original.historico.series],
            },
        });
        expect(guardado).toStrictEqual(original);
    });

    it("reutiliza una ampliación ya guardada y no vuelve a descargarla en la siguiente visita", async () => {
        sembrar(10, hoy);

        await actualizarHistoricoEspecie(10, "2022-10-09");
        const ampliado = estados.get(10);
        await actualizarHistoricoEspecie(10, "2022-10-09");
        await actualizarHistoricoEspecie(10, "2023-10-09");

        expect(mocks.consultar).toHaveBeenCalledOnce();
        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(estados.get(10)).toBe(ampliado);
    });

    it("consultas simultáneas con inicios distintos releen lo guardado para completar cada cobertura", async () => {
        sembrar(10, hoy);
        let cola: Promise<void> = Promise.resolve();
        mocks.bloquear.mockImplementation(async (speciesId: number, trabajo: (datos: Contexto) => Promise<boolean>) => {
            const anterior = cola;
            let liberar!: () => void;
            cola = new Promise<void>((resolve) => { liberar = resolve; });
            await anterior;
            try {
                return await trabajo(contexto(speciesId));
            } finally {
                liberar();
            }
        });

        const primera = actualizarHistoricoEspecie(10, "2022-10-09");
        const segunda = actualizarHistoricoEspecie(10, "2021-10-09");
        expect(segunda).not.toBe(primera);
        await Promise.all([primera, segunda]);

        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta)).toEqual([
            { speciesId: 10, desde: "2022-10-09", hasta: "2023-10-09" },
            { speciesId: 10, desde: "2021-10-09", hasta: "2022-10-09" },
        ]);
        expect(estados.get(10)?.historico.from).toBe("2021-10-09");
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
    });

    it("prioriza actualizar hasta hoy antes de descargar fechas anteriores", async () => {
        sembrar(10, "2026-10-08");

        await actualizarHistoricoEspecie(10, "2022-10-09");

        expect(mocks.consultar).toHaveBeenCalledTimes(2);
        expect(mocks.consultar.mock.calls[0][1]).toEqual({ speciesId: 10, desde: "2026-10-08", hasta: hoy });
        expect(mocks.consultar.mock.calls[1][1]).toEqual({ speciesId: 10, desde: "2022-10-09", hasta: "2023-10-09" });
        expect(mocks.guardar.mock.calls.map(([estado]) => estado.fechaUltimaActualizacion)).toEqual([hoy, hoy]);
        expect(estados.get(10)?.historico.from).toBe("2022-10-09");
        expect(estados.get(10)?.historico.to).toBe(hoy);
    });

    it("completa la carga inicial de nueve años y luego amplía hasta el inicio solicitado", async () => {
        await actualizarHistoricoEspecie(10, "2016-10-09");

        expect(mocks.consultar).toHaveBeenCalledTimes(4);
        expect(mocks.consultar.mock.calls.slice(0, 3).map(([, consulta]) => consulta)).toEqual([
            { speciesId: 10, desde: "2017-10-09", hasta: "2020-10-09" },
            { speciesId: 10, desde: "2020-10-10", hasta: "2023-10-09" },
            { speciesId: 10, desde: "2023-10-10", hasta: hoy },
        ]);
        expect(mocks.consultar.mock.calls[3][1]).toEqual({ speciesId: 10, desde: "2016-10-09", hasta: "2017-10-09" });
        expect(mocks.guardar).toHaveBeenCalledTimes(2);
        expect(estados.get(10)?.historico.from).toBe("2016-10-09");
        expect(estados.get(10)?.historico.to).toBe(hoy);
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
    });

    it("mantiene disponible la carga inicial completada si falla la ampliación solicitada", async () => {
        let cantidadConsultas = 0;
        mocks.consultar.mockImplementation(async (_opciones: unknown, consulta: ConsultaHistorica) => {
            if (++cantidadConsultas === 4) throw new Error("Falló la ampliación.");
            return respuesta(consulta);
        });

        await expect(actualizarHistoricoEspecie(10, "2016-10-09")).resolves.toBeUndefined();

        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(estados.get(10)?.historico.from).toBe("2017-10-09");
        expect(estados.get(10)?.historico.to).toBe(hoy);
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
    });

    it("conserva la ampliación contigua del primer lote si falla un lote posterior y reintenta lo pendiente", async () => {
        const guardado = sembrar(10, hoy);
        const inicioAnterior = guardado.historico.from;
        let cantidadConsultas = 0;
        mocks.consultar.mockImplementation(async (_opciones: unknown, consulta: ConsultaHistorica) => {
            if (++cantidadConsultas === 4) throw new Error("Falló el segundo lote.");
            return respuesta(consulta);
        });

        await expect(actualizarHistoricoEspecie(10, "2010-10-09")).resolves.toBeUndefined();

        const ampliado = estados.get(10)!;
        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(ampliado.historico.from < inicioAnterior).toBe(true);
        expect(ampliado.historico.from > "2010-10-09").toBe(true);
        expect(ampliado.historico.to).toBe(hoy);
        expect(ampliado.fechaUltimaActualizacion).toBe(hoy);
        mocks.consultar.mockClear();

        await actualizarHistoricoEspecie(10, "2010-10-09");

        expect(mocks.consultar.mock.calls.every(([, consulta]) => consulta.hasta <= ampliado.historico.from)).toBe(true);
        expect(mocks.guardar).toHaveBeenCalledTimes(2);
        expect(estados.get(10)?.historico.from).toBe("2010-10-09");
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
    });
});
