import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaginaPublicacionesProductor, { dynamic } from "./page";
import type { ConfiguracionOrdenamiento } from "@/modulos/consulta-mercado/acciones/configuracion-ordenamiento";
import type { ReactNode } from "react";

type PropsContenedor = ComponentProps<typeof import("@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones").default>;

const mocks = vi.hoisted(() => ({
    requerirConsultaProductores: vi.fn(),
    obtenerPublicaciones: vi.fn(),
    obtenerConfiguracion: vi.fn(),
    contenedor: vi.fn<(props: PropsContenedor) => null>(() => null),
    encabezado: vi.fn<(props: { titulo: string; cantidad: number; subtitulo: string }) => ReactNode>(() => null),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    requerirConsultaProductores: mocks.requerirConsultaProductores,
}));

vi.mock("@/modulos/consulta-mercado/acciones/ConsultarPublicacionProductor.action", () => ({
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

const sesionOperador = {
    usuarioId: 1,
    rol: "OPERADOR",
    expiraEn: 2000000000,
};

const publicaciones = [
    { id: 1, especie: "Tomate", tipoPublicacion: "PRODUCTOR" },
    { id: 2, especie: "Acelga", tipoPublicacion: "PRODUCTOR" },
];

function configurar(cambios: Partial<ConfiguracionOrdenamiento> = {}) {
    const configuracion: ConfiguracionOrdenamiento = {
        habilitado: true,
        ordenLanding: "nombre_desc",
        ordenMercadoVirtual: "mayor_precio",
        ordenMercadoProduccion: "menor_precio",
        ...cambios,
    };
    mocks.obtenerConfiguracion.mockResolvedValue(configuracion);
}

function propsContenedor(): PropsContenedor {
    return mocks.contenedor.mock.calls.at(-1)![0];
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.requerirConsultaProductores.mockResolvedValue(sesionOperador);
    mocks.obtenerPublicaciones.mockResolvedValue({ publicaciones });
    mocks.contenedor.mockImplementation(() => null);
    mocks.encabezado.mockImplementation(({ titulo }) => <h1>{titulo}</h1>);
    configurar();
});

afterEach(cleanup);

describe("PaginaPublicacionesProductor", () => {
    it("configura renderizado dinámico", () => {
        expect(dynamic).toBe("force-dynamic");
    });

    it("muestra el encabezado con la cantidad de publicaciones", async () => {
        render(await PaginaPublicacionesProductor());
        expect(screen.getByRole("heading", { name: "Mercado Producción" })).toBeInTheDocument();
        expect(mocks.encabezado.mock.calls.at(-1)![0]).toEqual({
            titulo: "Mercado Producción",
            cantidad: 2,
            subtitulo: "publicaciones en la plataforma",
        });
    });

    it("entrega la sesión autorizada a la consulta de publicaciones", async () => {
        await PaginaPublicacionesProductor();
        expect(mocks.requerirConsultaProductores).toHaveBeenCalledOnce();
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledExactlyOnceWith(sesionOperador);
    });

    it("entrega las publicaciones al contenedor local", async () => {
        render(await PaginaPublicacionesProductor());
        expect(propsContenedor()).toHaveProperty("publicaciones", publicaciones);
        expect(propsContenedor()).not.toHaveProperty("resultado");
    });

    it("usa el orden de Mercado Producción y no los de Inicio o Mercado Virtual", async () => {
        configurar({
            ordenLanding: "nombre_desc",
            ordenMercadoVirtual: "mayor_precio",
            ordenMercadoProduccion: "menor_precio",
        });
        render(await PaginaPublicacionesProductor());
        expect(propsContenedor().ordenInicial).toBe("precioAsc");
    });

    it.each([
        { configurado: "menor_precio", esperado: "precioAsc" },
        { configurado: "mayor_precio", esperado: "precioDesc" },
        { configurado: "nombre_asc", esperado: "alfabeticoAsc" },
        { configurado: "nombre_desc", esperado: "alfabeticoDesc" },
        { configurado: "mas_vendidas", esperado: "prioridad" },
    ] as const)("convierte el orden de producción $configurado en $esperado", async ({ configurado, esperado }) => {
        configurar({ ordenMercadoProduccion: configurado });
        render(await PaginaPublicacionesProductor());
        expect(propsContenedor().ordenInicial).toBe(esperado);
    });

    it.each([true, false])("entrega el estado de ordenamiento %s", async (habilitado) => {
        configurar({ habilitado });
        render(await PaginaPublicacionesProductor());
        expect(propsContenedor().ordenamientoHabilitado).toBe(habilitado);
    });

    it("conserva el orden predeterminado con el switch apagado", async () => {
        configurar({ habilitado: false, ordenMercadoProduccion: "mayor_precio" });
        render(await PaginaPublicacionesProductor());
        expect(propsContenedor()).toMatchObject({
            ordenInicial: "precioDesc",
            ordenamientoHabilitado: false,
        });
    });

    it("no habilita la gestión administrativa para un operador", async () => {
        render(await PaginaPublicacionesProductor());
        expect(propsContenedor().esAdmin).toBe(false);
    });

    it("habilita la gestión administrativa para un administrador autorizado", async () => {
        mocks.requerirConsultaProductores.mockResolvedValue({ ...sesionOperador, rol: "ADMINISTRADOR" });
        render(await PaginaPublicacionesProductor());
        expect(propsContenedor().esAdmin).toBe(true);
    });

    it("permite una lista vacía de publicaciones", async () => {
        mocks.obtenerPublicaciones.mockResolvedValue({ publicaciones: [] });
        render(await PaginaPublicacionesProductor());
        expect(propsContenedor()).toHaveProperty("publicaciones", []);
        expect(mocks.encabezado.mock.calls.at(-1)![0].cantidad).toBe(0);
    });

    it("usa una lista vacía si la consulta devuelve null", async () => {
        mocks.obtenerPublicaciones.mockResolvedValue(null);
        render(await PaginaPublicacionesProductor());
        expect(propsContenedor()).toHaveProperty("publicaciones", []);
        expect(mocks.encabezado.mock.calls.at(-1)![0].cantidad).toBe(0);
    });

    it("no consulta datos si el control de acceso rechaza la solicitud", async () => {
        const error = new Error("NEXT_REDIRECT");
        mocks.requerirConsultaProductores.mockRejectedValue(error);
        await expect(PaginaPublicacionesProductor()).rejects.toBe(error);
        expect(mocks.obtenerPublicaciones).not.toHaveBeenCalled();
        expect(mocks.obtenerConfiguracion).not.toHaveBeenCalled();
    });

    it("espera la autorización antes de consultar datos", async () => {
        let autorizar!: (sesion: typeof sesionOperador) => void;
        mocks.requerirConsultaProductores.mockImplementation(() => new Promise<typeof sesionOperador>((resolve) => { autorizar = resolve; }));
        const pendiente = PaginaPublicacionesProductor();
        expect(mocks.obtenerPublicaciones).not.toHaveBeenCalled();
        expect(mocks.obtenerConfiguracion).not.toHaveBeenCalled();
        autorizar(sesionOperador);
        await pendiente;
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledExactlyOnceWith(sesionOperador);
        expect(mocks.obtenerConfiguracion).toHaveBeenCalledOnce();
    });

    it("propaga los errores de consulta de publicaciones", async () => {
        const error = new Error("Error de publicaciones");
        mocks.obtenerPublicaciones.mockRejectedValue(error);
        await expect(PaginaPublicacionesProductor()).rejects.toBe(error);
    });

    it("propaga los errores de consulta de configuración", async () => {
        const error = new Error("Error de configuración");
        mocks.obtenerConfiguracion.mockRejectedValue(error);
        await expect(PaginaPublicacionesProductor()).rejects.toBe(error);
    });
});