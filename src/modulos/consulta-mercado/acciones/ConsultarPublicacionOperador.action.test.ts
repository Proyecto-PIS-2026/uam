import { beforeEach, describe, expect, it, vi } from "vitest";
import obtenerPublicaciones from "./ConsultarPublicacionOperador.action";
import type { ConfiguracionOrdenamiento } from "./configuracion-ordenamiento";
import type { FiltrosConsulta, OrdenConsulta } from "./filtros-consulta";

const mocks = vi.hoisted(() => ({
    exigirConsultaMercadoPublico: vi.fn(),
    obtenerConfiguracionOrdenamiento: vi.fn(),
    consultarPublicaciones: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    exigirConsultaMercadoPublico: mocks.exigirConsultaMercadoPublico,
}));

vi.mock("./configuracion-ordenamiento", () => ({
    obtenerConfiguracionOrdenamiento: mocks.obtenerConfiguracionOrdenamiento,
}));

vi.mock("./PublicacionesOperador", () => ({
    consultarPublicaciones: mocks.consultarPublicaciones,
}));

const resultado = {
    publicaciones: [],
    opciones: [],
    naves: [],
    total: 0,
    totalCatalogo: 0,
};

function crearConfiguracion(cambios: Partial<ConfiguracionOrdenamiento> = {}): ConfiguracionOrdenamiento {
    return {
        habilitado: true,
        ordenLanding: "nombre_asc",
        ordenMercadoVirtual: "nombre_desc",
        ordenMercadoProduccion: "mayor_precio",
        ...cambios,
    };
}

function configurar(cambios: Partial<ConfiguracionOrdenamiento> = {}) {
    mocks.obtenerConfiguracionOrdenamiento.mockResolvedValue(crearConfiguracion(cambios));
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.exigirConsultaMercadoPublico.mockResolvedValue(undefined);
    mocks.consultarPublicaciones.mockResolvedValue(resultado);
    configurar();
});

describe("obtenerPublicaciones de operadores", () => {
    it("comprueba el acceso antes de consultar la configuración", async () => {
        mocks.obtenerConfiguracionOrdenamiento.mockImplementation(async () => {
            expect(mocks.exigirConsultaMercadoPublico).toHaveBeenCalledOnce();
            return crearConfiguracion();
        });
        await obtenerPublicaciones();
        expect(mocks.obtenerConfiguracionOrdenamiento).toHaveBeenCalledOnce();
    });

    it("no consulta datos si falla la autorización", async () => {
        const error = new Error("No autorizado");
        mocks.exigirConsultaMercadoPublico.mockRejectedValue(error);
        await expect(obtenerPublicaciones()).rejects.toBe(error);
        expect(mocks.obtenerConfiguracionOrdenamiento).not.toHaveBeenCalled();
        expect(mocks.consultarPublicaciones).not.toHaveBeenCalled();
    });

    it("devuelve el resultado de la consulta", async () => {
        await expect(obtenerPublicaciones()).resolves.toBe(resultado);
    });

    it("utiliza el orden de Mercado Virtual y no los de Inicio o Mercado Producción", async () => {
        configurar({
            ordenLanding: "nombre_desc",
            ordenMercadoVirtual: "menor_precio",
            ordenMercadoProduccion: "mayor_precio",
        });
        await obtenerPublicaciones();
        expect(mocks.consultarPublicaciones).toHaveBeenCalledExactlyOnceWith({ orden: "precioAsc" });
    });

    it.each<{ configurado: ConfiguracionOrdenamiento["ordenMercadoVirtual"]; esperado: OrdenConsulta }>([
        { configurado: "nombre_asc", esperado: "alfabeticoAsc" },
        { configurado: "nombre_desc", esperado: "alfabeticoDesc" },
        { configurado: "mas_vendidas", esperado: "prioridad" },
        { configurado: "menor_precio", esperado: "precioAsc" },
        { configurado: "mayor_precio", esperado: "precioDesc" },
    ])("aplica el predeterminado $configurado cuando no se solicita otro orden", async ({ configurado, esperado }) => {
        configurar({ ordenMercadoVirtual: configurado });
        await obtenerPublicaciones();
        expect(mocks.consultarPublicaciones).toHaveBeenCalledExactlyOnceWith({ orden: esperado });
    });

    it.each<OrdenConsulta>(["precioAsc", "precioDesc", "alfabeticoAsc", "alfabeticoDesc"])("respeta la selección %s cuando el ordenamiento está habilitado", async (orden) => {
        configurar({ habilitado: true });
        await obtenerPublicaciones({ orden });
        expect(mocks.consultarPublicaciones).toHaveBeenCalledExactlyOnceWith({ orden });
    });

    it.each<OrdenConsulta>(["precioAsc", "precioDesc", "alfabeticoAsc", "alfabeticoDesc", "prioridad", "ninguno"])("ignora la selección %s cuando el ordenamiento está deshabilitado", async (orden) => {
        configurar({ habilitado: false, ordenMercadoVirtual: "nombre_desc" });
        await obtenerPublicaciones({ orden });
        expect(mocks.consultarPublicaciones).toHaveBeenCalledExactlyOnceWith({ orden: "alfabeticoDesc" });
    });

    it("aplica el predeterminado si está deshabilitado y no recibe filtros", async () => {
        configurar({ habilitado: false, ordenMercadoVirtual: "mas_vendidas" });
        await obtenerPublicaciones();
        expect(mocks.consultarPublicaciones).toHaveBeenCalledExactlyOnceWith({ orden: "prioridad" });
    });

    it("conserva los demás filtros cuando reemplaza el orden", async () => {
        configurar({ habilitado: false, ordenMercadoVirtual: "nombre_desc" });
        const filtros: FiltrosConsulta = {
            busqueda: "tomate",
            especie: "Tomate",
            variedad: "Perita",
            presentacion: "Cajón",
            categoria: "I",
            calibre: "M",
            nave: "A",
            precioMinimo: "10",
            precioMaximo: "100",
            orden: "precioAsc",
        };
        await obtenerPublicaciones(filtros);
        expect(mocks.consultarPublicaciones).toHaveBeenCalledExactlyOnceWith({ ...filtros, orden: "alfabeticoDesc" });
        expect(filtros.orden).toBe("precioAsc");
    });

    it("conserva los filtros cuando utiliza el predeterminado con el switch activo", async () => {
        configurar({ habilitado: true, ordenMercadoVirtual: "mayor_precio" });
        await obtenerPublicaciones({ especie: "Acelga", precioMinimo: "20" });
        expect(mocks.consultarPublicaciones).toHaveBeenCalledExactlyOnceWith({
            especie: "Acelga",
            precioMinimo: "20",
            orden: "precioDesc",
        });
    });

    it("consulta la configuración vigente en cada solicitud", async () => {
        configurar({ habilitado: false, ordenMercadoVirtual: "nombre_asc" });
        await obtenerPublicaciones();
        configurar({ habilitado: false, ordenMercadoVirtual: "nombre_desc" });
        await obtenerPublicaciones();
        expect(mocks.obtenerConfiguracionOrdenamiento).toHaveBeenCalledTimes(2);
        expect(mocks.consultarPublicaciones).toHaveBeenNthCalledWith(1, { orden: "alfabeticoAsc" });
        expect(mocks.consultarPublicaciones).toHaveBeenNthCalledWith(2, { orden: "alfabeticoDesc" });
    });

    it("propaga el error de configuración sin consultar publicaciones", async () => {
        const error = new Error("No se pudo leer la configuración");
        mocks.obtenerConfiguracionOrdenamiento.mockRejectedValue(error);
        await expect(obtenerPublicaciones()).rejects.toBe(error);
        expect(mocks.consultarPublicaciones).not.toHaveBeenCalled();
    });

    it("propaga los errores de consulta de publicaciones", async () => {
        const error = new Error("No se pudieron consultar las publicaciones");
        mocks.consultarPublicaciones.mockRejectedValue(error);
        await expect(obtenerPublicaciones()).rejects.toBe(error);
    });
});