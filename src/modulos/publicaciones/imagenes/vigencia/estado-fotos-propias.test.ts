import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agregarEstadoFotosPropias } from "./estado-fotos-propias";

const configuracion = vi.hoisted(() => ({ habilitado: true, diasVigencia: 3, avisosHabilitados: true, diasAnticipacionAviso: 1 }));
const mocksConfiguracion = vi.hoisted(() => ({ obtener: vi.fn() }));
vi.mock("./configuracion-aging-fotos", () => ({ obtenerConfiguracionAgingFotos: mocksConfiguracion.obtener }));

const mocks = vi.hoisted(() => ({ seleccionar: vi.fn(), filtrar: vi.fn(), listar: vi.fn() }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: { Imagen: { select: mocks.seleccionar } } } },
}));

const archivo = "12345678-1234-4234-8234-123456789abc.webp";
const url = (id: number) => `/api/publicaciones/imagenes/${id}/${archivo}`;
const clave = (id: number) => `publicaciones/${id}/${archivo}`;

beforeEach(() => {
    vi.resetAllMocks();
    Object.assign(configuracion, { habilitado: true, diasVigencia: 3, avisosHabilitados: true, diasAnticipacionAviso: 1 });
    mocksConfiguracion.obtener.mockImplementation(async () => configuracion);
    mocks.seleccionar.mockReturnValue({ where: mocks.filtrar });
    mocks.filtrar.mockReturnValue({ all: mocks.listar });
    mocks.listar.mockResolvedValue([]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-04T03:00:00Z"));
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("estado privado de la foto de una publicación", () => {
    it("calcula el aviso visual con los plazos propios de cada rol", async () => {
        mocksConfiguracion.obtener.mockImplementation(async (tipo) => tipo === "OPERADOR" ? configuracion : {
            habilitado: true, diasVigencia: 10, avisosHabilitados: true, diasAnticipacionAviso: 2,
        });
        mocks.listar.mockResolvedValue([{ clave: clave(1), cargadaEn: "2026-11-02T03:00:00Z" }]);

        const [operador] = await agregarEstadoFotosPropias([{ foto: url(1) }], "OPERADOR");
        const [productor] = await agregarEstadoFotosPropias([{ foto: url(1) }], "PRODUCTOR");

        expect(operador.estadoFoto).toBe("por-vencer");
        expect(productor.estadoFoto).toBeNull();
        expect(mocksConfiguracion.obtener).toHaveBeenNthCalledWith(1, "OPERADOR");
        expect(mocksConfiguracion.obtener).toHaveBeenNthCalledWith(2, "PRODUCTOR");
    });

    it("conserva la foto y el aviso amarillo hasta su borrado, incluso al alcanzar o superar el vencimiento", async () => {
        const fechas = [
            "2026-11-02T03:00:00.001Z",
            "2026-11-02T03:00:00Z",
            "2026-11-01T03:00:00.001Z",
            "2026-11-01T03:00:00Z",
            "2026-10-31T03:00:00Z",
            "2026-11-15T03:00:00Z",
        ];
        mocks.listar.mockResolvedValue(fechas.map((cargadaEn, indice) => ({ clave: clave(indice + 1), cargadaEn })));
        const publicaciones = fechas.map((_, indice) => ({ id: indice + 1, foto: url(indice + 1), precio: "25" }));

        const resultado = await agregarEstadoFotosPropias(publicaciones, "OPERADOR");

        expect(resultado.map(({ estadoFoto }) => estadoFoto)).toEqual([null, "por-vencer", "por-vencer", "por-vencer", "por-vencer", null]);
        expect(resultado.map(({ foto }) => foto)).toEqual(publicaciones.map(({ foto }) => foto));
        expect(resultado.every(({ precio }) => precio === "25")).toBe(true);
        expect(mocks.seleccionar).toHaveBeenCalledExactlyOnceWith("clave", "cargadaEn");
        expect(mocks.listar).toHaveBeenCalledOnce();
        expect(publicaciones[3].foto).toBe(url(4));
    });

    it("solo indica eliminación cuando existe su marca persistida, sin confundir nunca cargadas o retiradas manualmente", async () => {
        const resultado = await agregarEstadoFotosPropias([
            { id: 1, foto: null, fotoEliminadaPorVencimientoEn: "2026-11-04T03:00:00Z" },
            { id: 2, foto: null, fotoEliminadaPorVencimientoEn: null },
            { id: 3, foto: null },
            { id: 4, foto: null, estadoFoto: "eliminada" },
        ], "OPERADOR");

        expect(resultado.map(({ estadoFoto }) => estadoFoto)).toEqual(["eliminada", null, null, "eliminada"]);
        expect(mocks.seleccionar).not.toHaveBeenCalled();
    });

    it("ignora avisos viejos al reemplazar la foto y no necesita leer notificaciones", async () => {
        mocks.listar.mockResolvedValue([{ clave: clave(1), cargadaEn: "2026-11-04T02:59:59Z" }]);

        const [publicacion] = await agregarEstadoFotosPropias([{
            foto: url(1), estadoFoto: "eliminada", fotoEliminadaPorVencimientoEn: "2026-11-02T03:00:00Z",
        }], "OPERADOR");

        expect(publicacion).toMatchObject({ foto: url(1), estadoFoto: null });
        expect(mocks.listar).toHaveBeenCalledOnce();
    });

    it("no deduce aging de fotos sin fecha ni de imágenes estáticas anteriores", async () => {
        mocks.listar.mockResolvedValue([{ clave: clave(1), cargadaEn: null }]);

        expect(await agregarEstadoFotosPropias([{ foto: url(1) }, { foto: "/publicaciones-demo/papa.webp" }], "OPERADOR")).toEqual([
            { foto: url(1), estadoFoto: null }, { foto: "/publicaciones-demo/papa.webp", estadoFoto: null },
        ]);
    });

    it("no modifica la foto ni inventa un vencimiento si no encuentra su fecha de carga", async () => {
        expect(await agregarEstadoFotosPropias([{ foto: url(1) }], "OPERADOR")).toEqual([{ foto: url(1), estadoFoto: null }]);
    });

    it("respeta deshabilitar aging y conserva el hecho de una eliminación anterior", async () => {
        configuracion.habilitado = false;

        expect(await agregarEstadoFotosPropias([
            { foto: url(1), estadoFoto: "por-vencer" },
            { foto: null, fotoEliminadaPorVencimientoEn: "2026-11-01T03:00:00Z" },
        ], "OPERADOR")).toEqual([
            { foto: url(1), estadoFoto: null },
            { foto: null, fotoEliminadaPorVencimientoEn: "2026-11-01T03:00:00Z", estadoFoto: "eliminada" },
        ]);
        expect(mocks.seleccionar).not.toHaveBeenCalled();
    });

    it.each(["La configuración es inválida", "No se pudo leer la configuración"])("conserva las fotos y registra el error: %s", async (mensaje) => {
        mocksConfiguracion.obtener.mockRejectedValue(new Error(mensaje));
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);

        expect(await agregarEstadoFotosPropias([{ foto: url(1) }], "OPERADOR")).toEqual([{ foto: url(1), estadoFoto: null }]);
        expect(mocks.seleccionar).not.toHaveBeenCalled();
        expect(registrar).toHaveBeenCalledOnce();
    });

    it("no muestra el aviso previo si está deshabilitado y mantiene la marca de una foto eliminada", async () => {
        Object.assign(configuracion, { avisosHabilitados: false, diasAnticipacionAviso: 0 });

        expect(await agregarEstadoFotosPropias([
            { foto: url(1), estadoFoto: "por-vencer" },
            { foto: null, fotoEliminadaPorVencimientoEn: "2026-11-01T03:00:00Z" },
        ], "OPERADOR")).toEqual([
            { foto: url(1), estadoFoto: null },
            { foto: null, fotoEliminadaPorVencimientoEn: "2026-11-01T03:00:00Z", estadoFoto: "eliminada" },
        ]);
        expect(mocks.seleccionar).not.toHaveBeenCalled();
    });

    it("agrupa las claves sin repetirlas y valida sus rutas antes de consultar", async () => {
        const incluir = vi.fn();
        mocks.filtrar.mockImplementation((filtro) => {
            filtro({ clave: { in: incluir } });
            return { all: mocks.listar };
        });
        mocks.listar.mockResolvedValue([{ clave: clave(1), cargadaEn: null }]);

        await agregarEstadoFotosPropias([{ foto: url(1) }, { foto: url(1) }, { foto: "/api/publicaciones/imagenes/0/archivo.webp" }], "OPERADOR");

        expect(incluir).toHaveBeenCalledExactlyOnceWith([clave(1)]);
        expect(mocks.listar).toHaveBeenCalledOnce();
    });
});
