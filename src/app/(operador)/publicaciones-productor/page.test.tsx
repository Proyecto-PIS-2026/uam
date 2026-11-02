import type { ComponentProps, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaginaPublicacionesProductor, { dynamic } from "./page";
import type { ConfiguracionOrdenamiento } from "@/modulos/consulta-mercado/acciones/configuracion-ordenamiento";
import type { PublicacionProductorListado } from "@/modulos/consulta-mercado/acciones/PublicacionesProductor";

type PropsContenedor = ComponentProps<typeof import("@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones").default>;
type PropsEncabezado = { titulo: string; cantidad: number; subtitulo: string };

const mocks = vi.hoisted(() => ({
    requerirConsultaProductores: vi.fn(),
    consultarPublicacionesProductores: vi.fn(),
    obtenerConfiguracion: vi.fn(),
    contenedor: vi.fn<(props: PropsContenedor) => null>(() => null),
    encabezado: vi.fn<(props: PropsEncabezado) => ReactNode>(() => null),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    requerirConsultaProductores: mocks.requerirConsultaProductores,
}));

vi.mock("@/modulos/consulta-mercado/acciones/PublicacionesProductor", () => ({
    consultarPublicacionesProductores: mocks.consultarPublicacionesProductores,
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

const publicaciones: PublicacionProductorListado[] = [
    {
        id: 1,
        precio: 100,
        fecha: "2026-10-20T12:00:00Z",
        foto: null,
        especie: "Tomate",
        variedad: "Perita",
        presentacion: "Cajón",
        cantidadUnidades: 10,
        categoria: "",
        calibre: "",
        codigoCalibre: "",
        pais: "Uruguay",
        tipoPublicacion: "PRODUCTOR",
        productor: { id: 1, nombreFantasia: "Productor uno", fotoPerfil: null, whatsApp: "099123456" },
        ubicaciones: [],
    },
    {
        id: 2,
        precio: 80,
        fecha: "2026-10-21T12:00:00Z",
        foto: null,
        especie: "Acelga",
        variedad: "",
        presentacion: "Atado",
        cantidadUnidades: null,
        categoria: "",
        calibre: "",
        codigoCalibre: "",
        pais: "Uruguay",
        tipoPublicacion: "PRODUCTOR",
        productor: { id: 2, nombreFantasia: "Productor dos", fotoPerfil: null, whatsApp: "099654321" },
        ubicaciones: [],
    },
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
    mocks.consultarPublicacionesProductores.mockResolvedValue({ publicaciones });
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
        expect(mocks.consultarPublicacionesProductores).toHaveBeenCalledExactlyOnceWith(sesionOperador);
    });

    it("verifica el acceso antes de consultar publicaciones y configuración", async () => {
        await PaginaPublicacionesProductor();
        expect(mocks.requerirConsultaProductores).toHaveBeenCalledOnce();
        expect(mocks.consultarPublicacionesProductores).toHaveBeenCalledOnce();
        expect(mocks.obtenerConfiguracion).toHaveBeenCalledOnce();
        const ordenAcceso = mocks.requerirConsultaProductores.mock.invocationCallOrder[0];
        expect(ordenAcceso).toBeLessThan(mocks.consultarPublicacionesProductores.mock.invocationCallOrder[0]);
        expect(ordenAcceso).toBeLessThan(mocks.obtenerConfiguracion.mock.invocationCallOrder[0]);
    });

    it("no consulta datos si falla el acceso", async () => {
        const error = new Error("NEXT_REDIRECT");
        mocks.requerirConsultaProductores.mockRejectedValue(error);
        await expect(PaginaPublicacionesProductor()).rejects.toBe(error);
        expect(mocks.consultarPublicacionesProductores).not.toHaveBeenCalled();
        expect(mocks.obtenerConfiguracion).not.toHaveBeenCalled();
        expect(mocks.contenedor).not.toHaveBeenCalled();
    });

    it("espera a que se confirme el acceso antes de consultar datos", async () => {
        let autorizar!: () => void;
        mocks.requerirConsultaProductores.mockImplementation(() => new Promise<typeof sesionOperador>((resolve) => { autorizar = () => resolve(sesionOperador) }));
        const pendiente = PaginaPublicacionesProductor();
        expect(mocks.consultarPublicacionesProductores).not.toHaveBeenCalled();
        expect(mocks.obtenerConfiguracion).not.toHaveBeenCalled();
        autorizar();
        await pendiente;
        expect(mocks.consultarPublicacionesProductores).toHaveBeenCalledExactlyOnceWith(sesionOperador);
        expect(mocks.obtenerConfiguracion).toHaveBeenCalledOnce();
    });

    it.each(["OPERADOR", "ADMINISTRADOR"] as const)("entrega las publicaciones y el indicador administrativo para el rol %s", async (rol) => {
        const sesion = { usuarioId: 23, rol, expiraEn: 2000000000 };
        mocks.requerirConsultaProductores.mockResolvedValue(sesion);
        render(await PaginaPublicacionesProductor());
        expect(mocks.consultarPublicacionesProductores).toHaveBeenCalledExactlyOnceWith(sesion);
        expect(propsContenedor()).toHaveProperty("publicaciones", publicaciones);
        expect(propsContenedor().esAdmin).toBe(rol === "ADMINISTRADOR");
    });

    it("entrega las publicaciones al contenedor local", async () => {
        render(await PaginaPublicacionesProductor());
        expect(propsContenedor()).toHaveProperty("publicaciones", publicaciones);
        expect(propsContenedor()).not.toHaveProperty("resultado");
    });

    it("muestra cantidad cero cuando no hay publicaciones", async () => {
        mocks.consultarPublicacionesProductores.mockResolvedValue({ publicaciones: [] });
        render(await PaginaPublicacionesProductor());
        expect(mocks.encabezado.mock.calls.at(-1)![0].cantidad).toBe(0);
        expect(propsContenedor()).toHaveProperty("publicaciones", []);
    });

    it("usa el orden de Mercado Producción y no los de Inicio o Mercado Virtual", async () => {
        configurar({ ordenLanding: "nombre_desc", ordenMercadoVirtual: "mayor_precio", ordenMercadoProduccion: "menor_precio" });
        render(await PaginaPublicacionesProductor());
        expect(propsContenedor().ordenInicial).toBe("precioAsc");
    });

    it.each([
        { configurado: "menor_precio", esperado: "precioAsc" },
        { configurado: "mayor_precio", esperado: "precioDesc" },
        { configurado: "nombre_asc", esperado: "alfabeticoAsc" },
        { configurado: "nombre_desc", esperado: "alfabeticoDesc" },
        { configurado: "mas_vendidas", esperado: "prioridad" },
        { configurado: "mas_actualizadas", esperado: "fechaDesc" },
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
        expect(propsContenedor()).toMatchObject({ ordenInicial: "precioDesc", ordenamientoHabilitado: false });
    });

    it("permite usar Más actualizadas como predeterminado con el switch apagado", async () => {
        configurar({ habilitado: false, ordenMercadoProduccion: "mas_actualizadas" });
        render(await PaginaPublicacionesProductor());
        expect(propsContenedor()).toMatchObject({ ordenInicial: "fechaDesc", ordenamientoHabilitado: false });
    });

    it.each([["publicaciones", mocks.consultarPublicacionesProductores], ["configuración", mocks.obtenerConfiguracion]])("propaga los errores de consulta de %s", async (_, consulta) => {
        const error = new Error("Error de consulta");
        consulta.mockRejectedValueOnce(error);
        await expect(PaginaPublicacionesProductor()).rejects.toBe(error);
        expect(mocks.contenedor).not.toHaveBeenCalled();
        expect(mocks.encabezado).not.toHaveBeenCalled();
    });
});