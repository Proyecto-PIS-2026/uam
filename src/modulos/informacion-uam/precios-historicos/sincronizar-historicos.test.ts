import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EstadoHistorico } from "./almacen-historicos";
import type { ConsultaHistorica } from "./parametros-consulta";
import { actualizarHistoricoEspecie, fechaInicioImportacion } from "./sincronizar-historicos";
import type { HistoricoProducto } from "./tipos";

const mocks = vi.hoisted(() => ({
    consultar: vi.fn(),
    leer: vi.fn(),
    guardar: vi.fn(),
    bloquear: vi.fn(),
}));

vi.mock("./almacen-historicos", () => ({ conBloqueoActualizacion: mocks.bloquear }));
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
        estados.set(estado.historico.species_id, estado);
    });
    mocks.bloquear.mockImplementation(async (speciesId: number, trabajo: (datos: Contexto) => Promise<void>) => {
        await trabajo(contexto(speciesId));
    });
    mocks.consultar.mockImplementation(async (_opciones: unknown, consulta: ConsultaHistorica) => respuesta(consulta));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
});

describe("período inicial", () => {
    it("consulta tres años cuando la especie todavía no tiene histórico", () => {
        expect(fechaInicioImportacion(hoy)).toBe("2023-10-09");
    });

    it("ajusta el 29 de febrero cuando el año inicial no es bisiesto", () => {
        expect(fechaInicioImportacion("2024-02-29")).toBe("2021-02-28");
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

    it("crea automáticamente el histórico inicial de tres años para la especie seleccionada", async () => {
        await actualizarHistoricoEspecie(10);

        expect(mocks.consultar).toHaveBeenCalledExactlyOnceWith(
            { baseUrl, token: "token-de-prueba" },
            { speciesId: 10, desde: "2023-10-09", hasta: hoy },
        );
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
        expect(estados.size).toBe(1);
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
        mocks.bloquear.mockImplementation(async (speciesId: number, trabajo: (datos: Contexto) => Promise<void>) => {
            const anterior = cola;
            let liberar!: () => void;
            cola = new Promise<void>((resolve) => { liberar = resolve; });
            await anterior;
            try {
                await trabajo(contexto(speciesId));
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
        expect(estados.get(10)).toBe(guardado);
    });

    it("relee dentro del bloqueo y omite el pedido si otra instancia ya actualizó la especie", async () => {
        sembrar(10, "2026-10-08");
        mocks.bloquear.mockImplementation(async (speciesId: number, trabajo: (datos: Contexto) => Promise<void>) => {
            sembrar(speciesId, hoy);
            await trabajo(contexto(speciesId));
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

    it("un fallo de la primera carga se propaga sin guardar información incompleta", async () => {
        const fallo = new Error("El webservice respondió con estado 503.");
        mocks.consultar.mockRejectedValueOnce(fallo);

        await expect(actualizarHistoricoEspecie(10)).rejects.toBe(fallo);

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

    it("reintenta la carga inicial después de un fallo y conserva el período de tres años", async () => {
        mocks.consultar.mockRejectedValueOnce(new Error("El webservice no está disponible."));
        await expect(actualizarHistoricoEspecie(10)).rejects.toThrow("no está disponible");

        await actualizarHistoricoEspecie(10);

        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta)).toEqual([
            { speciesId: 10, desde: "2023-10-09", hasta: hoy },
            { speciesId: 10, desde: "2023-10-09", hasta: hoy },
        ]);
        expect(mocks.guardar).toHaveBeenCalledOnce();
    });

    it("usa la fecha de Montevideo aunque UTC ya esté en el día siguiente", async () => {
        vi.setSystemTime(new Date("2026-10-10T01:30:00Z"));
        sembrar(10, "2026-10-08");

        await actualizarHistoricoEspecie(10);

        expect(mocks.consultar).toHaveBeenCalledWith(expect.anything(), { speciesId: 10, desde: "2026-10-08", hasta: hoy });
    });
});
