import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaginaPublicaciones, { dynamic } from "./page";
import type { ConfiguracionOrdenamiento } from "@/modulos/consulta-mercado/acciones/configuracion-ordenamiento";
import type { ReactNode } from "react";

type PropsContenedor = ComponentProps<typeof import("@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones").default>;

const mocks = vi.hoisted(() => ({
    redirigirAMercadoPropio: vi.fn(),
    obtenerPublicaciones: vi.fn(),
    obtenerConfiguracion: vi.fn(),
    contenedor: vi.fn<(props: PropsContenedor) => null>(() => null),
    encabezado: vi.fn<(props: { titulo: string; cantidad: number; subtitulo: string }) => ReactNode>(() => null),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    redirigirAMercadoPropio: mocks.redirigirAMercadoPropio,
}));

vi.mock("@/modulos/consulta-mercado/acciones/ConsultarPublicacionOperador.action", () => ({
    default: mocks.obtenerPublicaciones,
}));

vi.mock("@/modulos/consulta-mercado/acciones/configuracion-ordenamiento", () => ({
    obtenerConfiguracionOrdenamiento: mocks.obtenerConfiguracion,
}));

vi.mock("@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones", () => ({
    default: mocks.contenedor,
}));

vi.mock("@/compartido/EncabezadoPagina", () => ({
    default: mocks.encabezado,
}));

const resultado = {
    publicaciones: [],
    opciones: [],
    naves: [],
    total: 12,
    totalCatalogo: 70,
};

function configurar(cambios: Partial<ConfiguracionOrdenamiento> = {}) {
    const configuracion: ConfiguracionOrdenamiento = {
        habilitado: true,
        ordenLanding: "nombre_asc",
        ordenMercadoVirtual: "nombre_desc",
        ordenMercadoProduccion: "mayor_precio",
        ...cambios,
    };
    mocks.obtenerConfiguracion.mockResolvedValue(configuracion);
}

async function mostrar(especie?: string) {
    render(await PaginaPublicaciones({ searchParams: Promise.resolve(especie === undefined ? {} : { especie }) }));
}

function propsContenedor(): PropsContenedor {
    return mocks.contenedor.mock.calls.at(-1)![0];
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.redirigirAMercadoPropio.mockResolvedValue(null);
    mocks.obtenerPublicaciones.mockResolvedValue(resultado);
    mocks.contenedor.mockImplementation(() => null);
    mocks.encabezado.mockImplementation(({ titulo }) => <h1>{titulo}</h1>);
    configurar();
});

afterEach(cleanup);

describe("PaginaPublicaciones", () => {
    it("configura renderizado dinámico", () => {
        expect(dynamic).toBe("force-dynamic");
    });

    it("muestra el encabezado con la cantidad total del catálogo", async () => {
        await mostrar();
        expect(screen.getByRole("heading", { name: "Mercado Virtual" })).toBeInTheDocument();
        expect(mocks.encabezado.mock.calls.at(-1)![0]).toEqual({
            titulo: "Mercado Virtual",
            cantidad: 70,
            subtitulo: "publicaciones en la plataforma",
        });
    });

    it("consulta todas las especies cuando no recibe un filtro", async () => {
        await mostrar();
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledExactlyOnceWith({ especie: "" });
        expect(propsContenedor().especie).toBe("");
    });

    it("conserva el filtro de especie recibido por URL", async () => {
        await mostrar("Tomate");
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledExactlyOnceWith({ especie: "Tomate" });
        expect(propsContenedor().especie).toBe("Tomate");
    });

    it("entrega el resultado de la consulta al contenedor", async () => {
        await mostrar();
        expect(propsContenedor()).toHaveProperty("resultado", resultado);
    });

    it("utiliza el orden de Mercado Virtual y no los de Inicio o Mercado Producción", async () => {
        configurar({
            ordenLanding: "nombre_desc",
            ordenMercadoVirtual: "menor_precio",
            ordenMercadoProduccion: "mayor_precio",
        });
        await mostrar();
        expect(propsContenedor().ordenInicial).toBe("precioAsc");
    });

    it.each([
        { configurado: "nombre_asc", esperado: "alfabeticoAsc" },
        { configurado: "nombre_desc", esperado: "alfabeticoDesc" },
        { configurado: "mas_vendidas", esperado: "prioridad" },
        { configurado: "menor_precio", esperado: "precioAsc" },
        { configurado: "mayor_precio", esperado: "precioDesc" },
    ] as const)("convierte el orden de Mercado Virtual $configurado en $esperado", async ({ configurado, esperado }) => {
        configurar({ ordenMercadoVirtual: configurado });
        await mostrar();
        expect(propsContenedor().ordenInicial).toBe(esperado);
    });

    it.each([true, false])("entrega al contenedor el estado de ordenamiento %s", async (habilitado) => {
        configurar({ habilitado });
        await mostrar();
        expect(propsContenedor().ordenamientoHabilitado).toBe(habilitado);
    });

    it("mantiene el orden de Mercado Virtual cuando el switch está apagado", async () => {
        configurar({ habilitado: false, ordenMercadoVirtual: "mayor_precio" });
        await mostrar();
        expect(propsContenedor()).toMatchObject({
            ordenInicial: "precioDesc",
            ordenamientoHabilitado: false,
        });
    });

    it.each([
        { rol: "ADMINISTRADOR", esperado: true },
        { rol: "OPERADOR", esperado: false },
        { rol: "PRODUCTOR", esperado: false },
    ])("establece esAdmin=$esperado para la sesión $rol devuelta por el control de acceso", async ({ rol, esperado }) => {
        mocks.redirigirAMercadoPropio.mockResolvedValue({ rol });
        await mostrar();
        expect(propsContenedor().esAdmin).toBe(esperado);
    });

    it("no habilita gestión administrativa para visitantes", async () => {
        mocks.redirigirAMercadoPropio.mockResolvedValue(null);
        await mostrar();
        expect(propsContenedor().esAdmin).toBe(false);
    });

    it("comprueba el acceso antes de consultar publicaciones", async () => {
        mocks.obtenerPublicaciones.mockImplementation(async () => {
            expect(mocks.redirigirAMercadoPropio).toHaveBeenCalledOnce();
            return resultado;
        });
        await mostrar();
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledOnce();
    });

    it("no consulta datos si el control de acceso redirige", async () => {
        const error = new Error("NEXT_REDIRECT");
        mocks.redirigirAMercadoPropio.mockRejectedValue(error);
        await expect(PaginaPublicaciones({ searchParams: Promise.resolve({}) })).rejects.toBe(error);
        expect(mocks.obtenerPublicaciones).not.toHaveBeenCalled();
        expect(mocks.obtenerConfiguracion).not.toHaveBeenCalled();
    });

    it("informa cuando la consulta no devuelve un resultado", async () => {
        mocks.obtenerPublicaciones.mockResolvedValue(null);
        await expect(PaginaPublicaciones({ searchParams: Promise.resolve({}) })).rejects.toThrow("No se pudieron cargar las publicaciones.");
        expect(mocks.contenedor).not.toHaveBeenCalled();
    });

    it("permite un catálogo vacío", async () => {
        const vacio = { publicaciones: [], opciones: [], naves: [], total: 0, totalCatalogo: 0 };
        mocks.obtenerPublicaciones.mockResolvedValue(vacio);
        await mostrar();
        expect(propsContenedor()).toHaveProperty("resultado", vacio);
        expect(mocks.encabezado.mock.calls.at(-1)![0].cantidad).toBe(0);
    });

    it("propaga los errores de consulta de publicaciones", async () => {
        const error = new Error("Error de publicaciones");
        mocks.obtenerPublicaciones.mockRejectedValue(error);
        await expect(PaginaPublicaciones({ searchParams: Promise.resolve({}) })).rejects.toBe(error);
    });

    it("propaga los errores al consultar la configuración", async () => {
        const error = new Error("Error de configuración");
        mocks.obtenerConfiguracion.mockRejectedValue(error);
        await expect(PaginaPublicaciones({ searchParams: Promise.resolve({}) })).rejects.toBe(error);
    });
});