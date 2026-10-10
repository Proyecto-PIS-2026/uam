import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EstadoHistorico } from "./almacen-historicos";
import type { ConsultaHistorica } from "./parametros-consulta";
import {
    actualizarHistoricosPrecios,
    fechaInicioImportacion,
    inicializarHistoricosPrecios,
} from "./sincronizar-historicos";
import type { HistoricoProducto } from "./tipos";

const mocks = vi.hoisted(() => ({
    especies: vi.fn(),
    catalogo: vi.fn(),
    consultar: vi.fn(),
    leer: vi.fn(),
    guardar: vi.fn(),
    listar: vi.fn(),
    completada: vi.fn(),
    registrar: vi.fn(),
    limpiar: vi.fn(),
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: { Especie: { select: () => ({ all: mocks.especies }) } } } },
}));
vi.mock("./almacen-historicos", () => ({
    leerHistorico: mocks.leer,
    guardarHistorico: mocks.guardar,
    listarEspeciesGuardadas: mocks.listar,
    sincronizacionCompletada: mocks.completada,
    registrarSincronizacion: mocks.registrar,
    limpiarCacheAnterior: mocks.limpiar,
}));
vi.mock("./catalogo-especies", () => ({ obtenerCatalogoEspeciesHistoricas: mocks.catalogo }));
vi.mock("./cliente-webservice", () => ({ consultarHistorico: mocks.consultar }));

const baseUrl = "https://precios.example.test/servicio";
const endpoint = "/historicos/{species_id}?inicio={from}&fin={to}";
const hoy = "2026-10-09";
const estados = new Map<number, EstadoHistorico>();

function fuente(): string {
    return createHash("sha256").update(JSON.stringify([baseUrl, endpoint])).digest("hex");
}

function respuesta(consulta: ConsultaHistorica): HistoricoProducto {
    return {
        classification_id: 1,
        classification: "Frutas",
        species_id: consulta.speciesId,
        species: `Especie ${consulta.speciesId}`,
        from: consulta.desde,
        to: consulta.hasta,
        series: [],
    };
}

function sembrar(speciesId: number, fechaUltimaActualizacion: string, origen = fuente()): EstadoHistorico {
    const estado: EstadoHistorico = {
        version: 2,
        fuente: origen,
        fechaUltimaActualizacion,
        historico: respuesta({ speciesId, desde: "2021-10-09", hasta: fechaUltimaActualizacion }),
    };
    estados.set(speciesId, estado);
    return estado;
}

beforeEach(() => {
    vi.resetAllMocks();
    estados.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T15:00:00Z"));
    vi.stubEnv("PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL", baseUrl);
    vi.stubEnv("PRECIOS_REFERENCIA_JWT_TOKEN", "token-de-prueba");
    vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", endpoint);
    vi.stubEnv("PRECIOS_HISTORICOS_ANIOS_INICIALES", undefined);
    vi.stubEnv("PRECIOS_HISTORICOS_INTERVALO_MS", "0");
    vi.stubEnv("PRECIOS_HISTORICOS_LIMITE_ESPECIES", undefined);
    mocks.especies.mockResolvedValue([{ uamId: 10 }]);
    mocks.catalogo.mockResolvedValue([]);
    mocks.leer.mockImplementation(async (speciesId: number) => estados.get(speciesId) ?? null);
    mocks.guardar.mockImplementation(async (estado: EstadoHistorico) => {
        estados.set(estado.historico.species_id, estado);
    });
    mocks.listar.mockImplementation(async () => [...estados.keys()]);
    mocks.completada.mockResolvedValue(false);
    mocks.consultar.mockImplementation(async (_opciones: unknown, consulta: ConsultaHistorica) => respuesta(consulta));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
});

describe("período de importación", () => {
    it("usa cinco años por defecto y admite cambiarlo a diez", () => {
        expect(fechaInicioImportacion(hoy)).toBe("2021-10-09");
        vi.stubEnv("PRECIOS_HISTORICOS_ANIOS_INICIALES", "10");
        expect(fechaInicioImportacion(hoy)).toBe("2016-10-09");
    });

    it("ajusta el 29 de febrero cuando el año inicial no es bisiesto", () => {
        expect(fechaInicioImportacion("2024-02-29")).toBe("2019-02-28");
    });

    it.each(["0", "-1", "1.5", "", "texto", "99999"])("rechaza el período configurado %j", (anios) => {
        vi.stubEnv("PRECIOS_HISTORICOS_ANIOS_INICIALES", anios);
        expect(() => fechaInicioImportacion(hoy)).toThrow();
    });
});

describe("inicializarHistoricosPrecios", () => {
    it("importa todos los identificadores UAM válidos, incluidas especies inactivas, sin duplicados", async () => {
        mocks.especies.mockResolvedValue([
            { uamId: 10, especieActiva: true },
            { uamId: 20, especieActiva: false },
            { uamId: 10, especieActiva: false },
            { uamId: null },
            { uamId: 0 },
            { uamId: -1 },
        ]);

        await expect(inicializarHistoricosPrecios()).resolves.toEqual({ total: 2, actualizadas: 2, omitidas: 0, errores: [] });

        expect(mocks.catalogo).not.toHaveBeenCalled();
        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta)).toEqual([
            { speciesId: 10, desde: "2021-10-09", hasta: hoy },
            { speciesId: 20, desde: "2021-10-09", hasta: hoy },
        ]);
        expect([...estados.keys()]).toEqual([10, 20]);
        expect(estados.get(20)?.fechaUltimaActualizacion).toBe(hoy);
        expect(mocks.limpiar).toHaveBeenCalledOnce();
    });

    it("usa el catálogo disponible cuando la base no tiene identificadores UAM", async () => {
        mocks.especies.mockResolvedValue([{ uamId: null }]);
        mocks.catalogo.mockResolvedValue([{ id: "30", especie: "Manzana" }, { id: "30", especie: "Manzana" }]);

        await expect(inicializarHistoricosPrecios()).resolves.toMatchObject({ total: 1, actualizadas: 1, errores: [] });

        expect(mocks.catalogo).toHaveBeenCalledOnce();
        expect(mocks.consultar).toHaveBeenCalledWith(expect.anything(), { speciesId: 30, desde: "2021-10-09", hasta: hoy });
    });

    it("envía el período configurado al webservice", async () => {
        vi.stubEnv("PRECIOS_HISTORICOS_ANIOS_INICIALES", "10");

        await inicializarHistoricosPrecios();

        expect(mocks.consultar).toHaveBeenCalledWith(expect.anything(), { speciesId: 10, desde: "2016-10-09", hasta: hoy });
    });

    it("repetir la carga no sobrescribe una especie inicializada aunque cambie el período", async () => {
        const anterior = sembrar(10, "2026-10-01");
        vi.stubEnv("PRECIOS_HISTORICOS_ANIOS_INICIALES", "10");

        await expect(inicializarHistoricosPrecios()).resolves.toEqual({ total: 1, actualizadas: 0, omitidas: 1, errores: [] });

        expect(mocks.consultar).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(estados.get(10)).toBe(anterior);
    });

    it("continúa después de un fallo y el siguiente intento importa sólo la especie pendiente", async () => {
        mocks.especies.mockResolvedValue([{ uamId: 10 }, { uamId: 20 }, { uamId: 30 }]);
        mocks.consultar.mockRejectedValueOnce(new Error("El webservice de precios históricos respondió con estado 503."));

        const primerIntento = await inicializarHistoricosPrecios();

        expect(primerIntento).toMatchObject({ total: 3, actualizadas: 2, omitidas: 0, errores: [{ speciesId: 10 }] });
        expect([...estados.keys()]).toEqual([20, 30]);
        expect(mocks.limpiar).not.toHaveBeenCalled();
        mocks.consultar.mockClear();

        await expect(inicializarHistoricosPrecios()).resolves.toEqual({ total: 3, actualizadas: 1, omitidas: 2, errores: [] });

        expect(mocks.consultar).toHaveBeenCalledExactlyOnceWith(expect.anything(), { speciesId: 10, desde: "2021-10-09", hasta: hoy });
        expect([...estados.keys()]).toEqual([20, 30, 10]);
        expect(mocks.limpiar).toHaveBeenCalledOnce();
    });
});

describe("actualizarHistoricosPrecios", () => {
    it("consulta todas las especies importadas desde su propia fecha y omite las de hoy", async () => {
        sembrar(10, "2026-10-01");
        sembrar(20, "2026-10-08");
        sembrar(30, hoy);

        await expect(actualizarHistoricosPrecios()).resolves.toEqual({ total: 3, actualizadas: 2, omitidas: 1, errores: [] });

        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta)).toEqual([
            { speciesId: 10, desde: "2026-10-01", hasta: hoy },
            { speciesId: 20, desde: "2026-10-08", hasta: hoy },
        ]);
        expect(mocks.especies).not.toHaveBeenCalled();
        expect(mocks.catalogo).not.toHaveBeenCalled();
        expect(mocks.registrar).toHaveBeenCalledExactlyOnceWith(hoy, fuente());
    });

    it("evita listar y leer documentos si el control diario ya está actualizado", async () => {
        mocks.completada.mockResolvedValue(true);

        await expect(actualizarHistoricosPrecios()).resolves.toEqual({ total: 0, actualizadas: 0, omitidas: 0, errores: [] });

        expect(mocks.completada).toHaveBeenCalledExactlyOnceWith(hoy, fuente());
        expect(mocks.listar).not.toHaveBeenCalled();
        expect(mocks.leer).not.toHaveBeenCalled();
        expect(mocks.consultar).not.toHaveBeenCalled();
    });

    it("una respuesta vacía con cobertura completa avanza la fecha de verificación", async () => {
        sembrar(10, "2026-10-08");

        await expect(actualizarHistoricosPrecios()).resolves.toMatchObject({ actualizadas: 1, errores: [] });

        expect(mocks.guardar).toHaveBeenCalledWith(expect.objectContaining({
            fechaUltimaActualizacion: hoy,
            historico: expect.objectContaining({ from: "2026-10-08", to: hoy, series: [] }),
        }));
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
    });

    it("un fallo mantiene la fecha pendiente, permite actualizar las otras y no marca el día completo", async () => {
        const pendiente = sembrar(10, "2026-10-01");
        sembrar(20, "2026-10-08");
        mocks.consultar.mockRejectedValueOnce(new Error("El webservice de precios históricos respondió con estado 503."));

        await expect(actualizarHistoricosPrecios()).resolves.toMatchObject({ total: 2, actualizadas: 1, errores: [{ speciesId: 10 }] });

        expect(estados.get(10)).toBe(pendiente);
        expect(estados.get(20)?.fechaUltimaActualizacion).toBe(hoy);
        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(mocks.registrar).not.toHaveBeenCalled();
    });

    it("rechaza cobertura parcial sin guardar ni adelantar el progreso", async () => {
        const anterior = sembrar(10, "2026-10-01");
        mocks.consultar.mockResolvedValue(respuesta({ speciesId: 10, desde: "2026-10-02", hasta: hoy }));

        const resultado = await actualizarHistoricosPrecios();

        expect(resultado).toMatchObject({ actualizadas: 0, errores: [{ speciesId: 10, mensaje: expect.stringContaining("cobertura completa") }] });
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.registrar).not.toHaveBeenCalled();
        expect(estados.get(10)).toBe(anterior);
    });

    it("rechaza una fuente distinta antes de consultar o mezclar información", async () => {
        const anterior = sembrar(10, "2026-10-01", "otra-fuente");

        await expect(actualizarHistoricosPrecios()).resolves.toMatchObject({
            actualizadas: 0,
            errores: [{ speciesId: 10, mensaje: expect.stringContaining("fuente") }],
        });

        expect(mocks.consultar).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(estados.get(10)).toBe(anterior);
        expect(mocks.registrar).not.toHaveBeenCalled();
    });

    it("una visita sin históricos no importa especies ni consulta al webservice", async () => {
        await expect(actualizarHistoricosPrecios()).resolves.toEqual({ total: 0, actualizadas: 0, omitidas: 0, errores: [] });

        expect(mocks.especies).not.toHaveBeenCalled();
        expect(mocks.catalogo).not.toHaveBeenCalled();
        expect(mocks.consultar).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.registrar).not.toHaveBeenCalled();
    });

    it("usa el día de Montevideo cuando UTC ya pasó a la fecha siguiente", async () => {
        vi.setSystemTime(new Date("2026-10-10T01:30:00Z"));
        sembrar(10, "2026-10-08");

        await actualizarHistoricosPrecios();

        expect(mocks.consultar).toHaveBeenCalledWith(expect.anything(), { speciesId: 10, desde: "2026-10-08", hasta: hoy });
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
    });

    it("una visita durante la carga inicial espera y luego actualiza las especies existentes pendientes", async () => {
        sembrar(60, "2026-10-08");
        let entregarCatalogo!: (especies: { uamId: number }[]) => void;
        let entregarRespuesta!: (historico: HistoricoProducto) => void;
        const catalogoPendiente = new Promise<{ uamId: number }[]>((resolve) => { entregarCatalogo = resolve; });
        const respuestaPendiente = new Promise<HistoricoProducto>((resolve) => { entregarRespuesta = resolve; });
        mocks.especies.mockReturnValueOnce(catalogoPendiente);
        mocks.consultar.mockReturnValueOnce(respuestaPendiente);

        const inicializacion = inicializarHistoricosPrecios();
        let visitaResuelta = false;
        const visita = actualizarHistoricosPrecios().then((resultado) => {
            visitaResuelta = true;
            return resultado;
        });
        entregarCatalogo([{ uamId: 60 }]);

        try {
            await expect(inicializacion).resolves.toEqual({ total: 1, actualizadas: 0, omitidas: 1, errores: [] });
            await vi.waitFor(() => {
                expect(mocks.consultar).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
                    speciesId: 60, desde: "2026-10-08", hasta: hoy,
                });
            });
            expect(visitaResuelta).toBe(false);
        } finally {
            entregarRespuesta(respuesta({ speciesId: 60, desde: "2026-10-08", hasta: hoy }));
            await visita;
        }

        await expect(visita).resolves.toEqual({ total: 1, actualizadas: 1, omitidas: 0, errores: [] });
        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(estados.get(60)?.fechaUltimaActualizacion).toBe(hoy);
    });

    it("las visitas concurrentes comparten la misma actualización pendiente", async () => {
        sembrar(10, "2026-10-08");
        let recibir!: (historico: HistoricoProducto) => void;
        let avisarConsulta!: () => void;
        const respuestaPendiente = new Promise<HistoricoProducto>((resolve) => { recibir = resolve; });
        const consultaIniciada = new Promise<void>((resolve) => { avisarConsulta = resolve; });
        mocks.consultar.mockImplementationOnce(() => {
            avisarConsulta();
            return respuestaPendiente;
        });

        const primera = actualizarHistoricosPrecios();
        const segunda = actualizarHistoricosPrecios();
        await consultaIniciada;
        expect(mocks.consultar).toHaveBeenCalledOnce();
        recibir(respuesta({ speciesId: 10, desde: "2026-10-08", hasta: hoy }));
        const resultados = await Promise.all([primera, segunda]);

        expect(resultados[0]).toEqual({ total: 1, actualizadas: 1, omitidas: 0, errores: [] });
        expect(resultados[1]).toEqual(resultados[0]);
        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(mocks.registrar).toHaveBeenCalledOnce();
    });
});

describe("cadencia de pedidos y límites del webservice", () => {
    it("espera un segundo entre pedidos por defecto, sin retrasar el primero", async () => {
        vi.stubEnv("PRECIOS_HISTORICOS_INTERVALO_MS", undefined);
        mocks.especies.mockResolvedValue([{ uamId: 10 }, { uamId: 20 }]);
        const inicio = Date.now();
        const tiempos: number[] = [];
        mocks.consultar.mockImplementation(async (_opciones: unknown, consulta: ConsultaHistorica) => {
            tiempos.push(Date.now() - inicio);
            return respuesta(consulta);
        });

        const carga = inicializarHistoricosPrecios();
        await vi.advanceTimersByTimeAsync(0);
        expect(tiempos).toEqual([0]);
        await vi.advanceTimersByTimeAsync(999);
        expect(tiempos).toEqual([0]);
        await vi.advanceTimersByTimeAsync(1);

        await expect(carga).resolves.toMatchObject({ actualizadas: 2, errores: [] });
        expect(tiempos).toEqual([0, 1000]);
    });

    it("aplica el intervalo configurado sólo entre pedidos, también después de un HTTP 500", async () => {
        vi.stubEnv("PRECIOS_HISTORICOS_INTERVALO_MS", "250");
        mocks.especies.mockResolvedValue([10, 20, 30, 40, 50].map((uamId) => ({ uamId })));
        for (const speciesId of [10, 30, 50]) sembrar(speciesId, hoy);
        const inicio = Date.now();
        const tiempos: number[] = [];
        mocks.consultar.mockImplementation(async (_opciones: unknown, consulta: ConsultaHistorica) => {
            tiempos.push(Date.now() - inicio);
            if (consulta.speciesId === 20) {
                throw Object.assign(new Error("El webservice de precios históricos respondió con estado 500."), { estadoHTTP: 500 });
            }
            return respuesta(consulta);
        });

        const carga = inicializarHistoricosPrecios();
        await vi.advanceTimersByTimeAsync(0);
        expect(tiempos).toEqual([0]);
        await vi.advanceTimersByTimeAsync(249);
        expect(tiempos).toEqual([0]);
        await vi.advanceTimersByTimeAsync(1);

        await expect(carga).resolves.toMatchObject({ total: 5, actualizadas: 1, omitidas: 3, errores: [{ speciesId: 20 }] });
        expect(tiempos).toEqual([0, 250]);
        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta.speciesId)).toEqual([20, 40]);
    });

    it.each(["-1", "1.5", "", " ", "texto", "Infinity", "2147483648"])("rechaza el intervalo %j antes de consultar", async (intervalo) => {
        vi.stubEnv("PRECIOS_HISTORICOS_INTERVALO_MS", intervalo);

        await expect(inicializarHistoricosPrecios()).rejects.toThrow("PRECIOS_HISTORICOS_INTERVALO_MS");

        expect(mocks.consultar).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("detiene la carga en un HTTP 429 y al reintentar importa sólo las pendientes", async () => {
        mocks.especies.mockResolvedValue([10, 20, 30, 40].map((uamId) => ({ uamId })));
        mocks.consultar.mockImplementationOnce(async (_opciones: unknown, consulta: ConsultaHistorica) => respuesta(consulta));
        mocks.consultar.mockRejectedValueOnce(Object.assign(
            new Error("El webservice de precios históricos respondió con estado 429."),
            { estadoHTTP: 429, reintentarEnMs: 120_000 },
        ));

        const resultado = await inicializarHistoricosPrecios();

        expect(resultado).toMatchObject({ total: 4, actualizadas: 1, omitidas: 0 });
        expect(resultado.errores.map(({ speciesId }) => speciesId)).toEqual([20, 30, 40]);
        expect(resultado.errores[0].mensaje).toContain("estado 429");
        expect(resultado.errores.every(({ mensaje }) => mensaje.includes("120 segundos"))).toBe(true);
        expect(resultado.errores[1].mensaje).toMatch(/^No consultada:.*HTTP 429/);
        expect(mocks.consultar).toHaveBeenCalledTimes(2);
        expect([...estados.keys()]).toEqual([10]);
        expect(mocks.limpiar).not.toHaveBeenCalled();
        expect(mocks.registrar).not.toHaveBeenCalled();
        mocks.consultar.mockClear();

        await expect(inicializarHistoricosPrecios()).resolves.toEqual({ total: 4, actualizadas: 3, omitidas: 1, errores: [] });

        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta.speciesId)).toEqual([20, 30, 40]);
        expect(mocks.limpiar).toHaveBeenCalledOnce();
    });

    it("un HTTP 429 diario mantiene pendientes las fechas y no marca el lote completo", async () => {
        sembrar(10, "2026-10-08");
        const limitada = sembrar(20, "2026-10-08");
        const noConsultada = sembrar(30, "2026-10-08");
        mocks.consultar.mockImplementationOnce(async (_opciones: unknown, consulta: ConsultaHistorica) => respuesta(consulta));
        mocks.consultar.mockRejectedValueOnce(Object.assign(
            new Error("El webservice de precios históricos respondió con estado 429."),
            { estadoHTTP: 429, reintentarEnMs: null },
        ));

        const resultado = await actualizarHistoricosPrecios();

        expect(resultado).toMatchObject({ total: 3, actualizadas: 1, errores: [{ speciesId: 20 }, { speciesId: 30 }] });
        expect(mocks.consultar).toHaveBeenCalledTimes(2);
        expect(mocks.guardar).toHaveBeenCalledOnce();
        expect(estados.get(10)?.fechaUltimaActualizacion).toBe(hoy);
        expect(estados.get(20)).toBe(limitada);
        expect(estados.get(30)).toBe(noConsultada);
        expect(resultado.errores[1].mensaje).toContain("Esperá antes de volver a intentar");
        expect(mocks.registrar).not.toHaveBeenCalled();
    });

    it("informa Retry-After aunque la última especie sea la que devuelve HTTP 429", async () => {
        mocks.consultar.mockRejectedValueOnce(Object.assign(
            new Error("El webservice de precios históricos respondió con estado 429."),
            { estadoHTTP: 429, reintentarEnMs: 45_000 },
        ));

        const resultado = await inicializarHistoricosPrecios();

        expect(resultado.errores).toEqual([{ speciesId: 10, mensaje: expect.stringContaining("45 segundos") }]);
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.limpiar).not.toHaveBeenCalled();
    });

    it("informa un error de configuración del cliente y detiene las restantes sin nuevos pedidos", async () => {
        mocks.especies.mockResolvedValue([10, 20, 30].map((uamId) => ({ uamId })));
        const mensaje = "PRECIOS_HISTORICOS_TIMEOUT_MS debe ser un entero positivo menor o igual a 2147483647.";
        mocks.consultar.mockRejectedValueOnce(new Error(mensaje));

        const resultado = await inicializarHistoricosPrecios();

        expect(resultado.errores[0]).toEqual({ speciesId: 10, mensaje });
        expect(resultado.errores.slice(1)).toEqual([
            { speciesId: 20, mensaje: expect.stringContaining("revisá la configuración del cliente") },
            { speciesId: 30, mensaje: expect.stringContaining("revisá la configuración del cliente") },
        ]);
        expect(mocks.consultar).toHaveBeenCalledOnce();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.limpiar).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe("límite de especies de la carga inicial", () => {
    it.each([undefined, "", " "])("sin un límite efectivo (%j) importa todas las especies", async (limite) => {
        vi.stubEnv("PRECIOS_HISTORICOS_LIMITE_ESPECIES", limite);
        mocks.especies.mockResolvedValue([10, 20, 30].map((uamId) => ({ uamId })));

        await expect(inicializarHistoricosPrecios()).resolves.toEqual({ total: 3, actualizadas: 3, omitidas: 0, errores: [] });

        expect(mocks.consultar).toHaveBeenCalledTimes(3);
        expect(mocks.limpiar).toHaveBeenCalledOnce();
    });

    it("el límite cuenta pedidos fallidos y omite las filas ya inicializadas", async () => {
        vi.stubEnv("PRECIOS_HISTORICOS_LIMITE_ESPECIES", "2");
        mocks.especies.mockResolvedValue([10, 20, 30, 40, 50, 60].map((uamId) => ({ uamId })));
        for (const speciesId of [10, 30, 60]) sembrar(speciesId, hoy);
        mocks.consultar.mockRejectedValueOnce(Object.assign(
            new Error("El webservice de precios históricos respondió con estado 500."),
            { estadoHTTP: 500 },
        ));

        const resultado = await inicializarHistoricosPrecios();

        expect(resultado).toMatchObject({ total: 6, actualizadas: 1, omitidas: 3, pendientes: 1, errores: [{ speciesId: 20 }] });
        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta.speciesId)).toEqual([20, 40]);
        expect(estados.has(50)).toBe(false);
        expect(mocks.limpiar).not.toHaveBeenCalled();
    });

    it("las siguientes ejecuciones importan las especies pendientes sin repetir las completadas", async () => {
        vi.stubEnv("PRECIOS_HISTORICOS_LIMITE_ESPECIES", "2");
        mocks.especies.mockResolvedValue([10, 20, 30, 40, 50].map((uamId) => ({ uamId })));

        await expect(inicializarHistoricosPrecios()).resolves.toEqual({ total: 5, actualizadas: 2, omitidas: 0, pendientes: 3, errores: [] });
        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta.speciesId)).toEqual([10, 20]);
        expect(mocks.limpiar).not.toHaveBeenCalled();
        mocks.consultar.mockClear();

        await expect(inicializarHistoricosPrecios()).resolves.toEqual({ total: 5, actualizadas: 2, omitidas: 2, pendientes: 1, errores: [] });
        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta.speciesId)).toEqual([30, 40]);
        expect(mocks.limpiar).not.toHaveBeenCalled();
        mocks.consultar.mockClear();

        await expect(inicializarHistoricosPrecios()).resolves.toEqual({ total: 5, actualizadas: 1, omitidas: 4, pendientes: 0, errores: [] });
        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta.speciesId)).toEqual([50]);
        expect(mocks.limpiar).toHaveBeenCalledOnce();
    });

    it("la actualización diaria incluye todas las especies importadas aunque exista un límite inicial", async () => {
        vi.stubEnv("PRECIOS_HISTORICOS_LIMITE_ESPECIES", "1");
        for (const speciesId of [10, 20, 30]) sembrar(speciesId, "2026-10-08");

        await expect(actualizarHistoricosPrecios()).resolves.toEqual({ total: 3, actualizadas: 3, omitidas: 0, errores: [] });

        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta.speciesId)).toEqual([10, 20, 30]);
        expect(mocks.registrar).toHaveBeenCalledOnce();
    });

    it.each(["0", "-1", "1.5", "texto", "Infinity"])("rechaza el límite %j antes de consultar", async (limite) => {
        vi.stubEnv("PRECIOS_HISTORICOS_LIMITE_ESPECIES", limite);

        await expect(inicializarHistoricosPrecios()).rejects.toThrow("PRECIOS_HISTORICOS_LIMITE_ESPECIES");

        expect(mocks.consultar).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("con límite cinco consulta primero las cinco especies en orden alfabético por nombre", async () => {
        vi.stubEnv("PRECIOS_HISTORICOS_LIMITE_ESPECIES", "5");
        mocks.especies.mockResolvedValue([
            { uamId: 70, nombreEspecie: "Zanahoria" },
            { uamId: 40, nombreEspecie: "Banana" },
            { uamId: 20, nombreEspecie: "Ajo" },
            { uamId: 60, nombreEspecie: "Cebolla" },
            { uamId: 50, nombreEspecie: "Berenjena" },
            { uamId: 10, nombreEspecie: "Acelga" },
            { uamId: 30, nombreEspecie: "Apio" },
        ]);

        await expect(inicializarHistoricosPrecios()).resolves.toEqual({ total: 7, actualizadas: 5, omitidas: 0, pendientes: 2, errores: [] });

        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta.speciesId)).toEqual([10, 20, 30, 40, 50]);
        expect(estados.has(60)).toBe(false);
        expect(estados.has(70)).toBe(false);
        expect(mocks.limpiar).not.toHaveBeenCalled();
    });

    it("ordena el catálogo alternativo por nombre antes de aplicar el límite", async () => {
        vi.stubEnv("PRECIOS_HISTORICOS_LIMITE_ESPECIES", "2");
        mocks.especies.mockResolvedValue([{ uamId: null }]);
        mocks.catalogo.mockResolvedValue([
            { id: "60", especie: "Banana" },
            { id: "70", especie: "Zanahoria" },
            { id: "20", especie: "Ajo" },
            { id: "10", especie: "Acelga" },
        ]);

        await expect(inicializarHistoricosPrecios()).resolves.toEqual({ total: 4, actualizadas: 2, omitidas: 0, pendientes: 2, errores: [] });

        expect(mocks.consultar.mock.calls.map(([, consulta]) => consulta.speciesId)).toEqual([10, 20]);
        expect(mocks.catalogo).toHaveBeenCalledOnce();
    });
});
