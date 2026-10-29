// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requerirOperador } from "@/modulos/identidad-acceso/autorizacion/controles";
import obtenerPublicaciones from "@/modulos/consulta-mercado/acciones/ConsultarPublicacionProductor.action";
import Page, { dynamic } from "./page";
import type { PublicacionProductorListado } from "@/modulos/consulta-mercado/acciones/PublicacionesProductor";
import { requerirConsultaProductores } from "@/modulos/identidad-acceso/autorizacion/controles";

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    requerirOperador: vi.fn(),
    requerirConsultaProductores: vi.fn(),
}));

vi.mock("@/modulos/consulta-mercado/acciones/ConsultarPublicacionProductor.action", () => ({
    default: vi.fn(),
}));

vi.mock("@/compartido/EncabezadoPagina", () => ({
    default: ({ titulo, cantidad, subtitulo }: { titulo: string; cantidad: number; subtitulo: string }) => (
        <header
            data-testid="encabezado-pagina"
            data-titulo={titulo}
            data-cantidad={cantidad}
            data-subtitulo={subtitulo}
        />
    ),
}));

vi.mock("@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones", () => ({    default: ({ publicaciones, esAdmin }: { publicaciones: unknown[]; esAdmin?: boolean }) => (
        <div data-testid="contenedor-publicaciones" data-cantidad={publicaciones.length} data-es-admin={esAdmin}>
            Publicaciones de productores: {publicaciones.length}
        </div>
    ),
}));

const sesionOperador = {
    usuarioId: 23,
    rol: "OPERADOR",
} as unknown as Awaited<ReturnType<typeof requerirOperador>>;

const publicacionesEjemplo = [
    { id: 101, especie: "Tomate" },
    { id: 102, especie: "Manzana" },
] as unknown as PublicacionProductorListado[];

type ResultadoMock = Awaited<ReturnType<typeof obtenerPublicaciones>>;

describe("Page de publicaciones de productores", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(requerirConsultaProductores).mockResolvedValue(sesionOperador);
        vi.mocked(obtenerPublicaciones).mockResolvedValue({ publicaciones: publicacionesEjemplo } as ResultadoMock);
    });

    afterEach(() => {
        cleanup();
    });

    it('declara la página como "force-dynamic"', () => {
        expect(dynamic).toBe("force-dynamic");
    });

    it.each(["OPERADOR", "ADMINISTRADOR"] as const)("permite cargar las publicaciones al rol %s", async (rol) => {
        const sesion = { usuarioId: 23, rol, expiraEn: 2000000000 };
        vi.mocked(requerirConsultaProductores).mockResolvedValue(sesion);
        render(await Page());
        expect(requerirConsultaProductores).toHaveBeenCalledTimes(1);
        expect(obtenerPublicaciones).toHaveBeenCalledExactlyOnceWith(sesion);
        expect(screen.getByTestId("contenedor-publicaciones")).toHaveAttribute("data-cantidad", "2");
        expect(screen.getByTestId("contenedor-publicaciones")).toHaveAttribute("data-es-admin", String(rol === "ADMINISTRADOR"));
    });

    it("muestra encabezado, cantidad y publicaciones cuando la consulta devuelve resultados", async () => {
        render(await Page());

        const encabezado = screen.getByTestId("encabezado-pagina");
        const contenedor = screen.getByTestId("contenedor-publicaciones");

        expect(encabezado.getAttribute("data-titulo")).toBe("Mercado Producción");
        expect(encabezado.getAttribute("data-cantidad")).toBe("2");
        expect(encabezado.getAttribute("data-subtitulo")).toBe("publicaciones en la plataforma");
        expect(contenedor.getAttribute("data-cantidad")).toBe("2");
        expect(contenedor.textContent).toContain("Publicaciones de productores: 2");
    });

    it("muestra cantidad cero cuando la consulta devuelve una lista vacía", async () => {
        vi.mocked(obtenerPublicaciones).mockResolvedValue({ publicaciones: [] } as ResultadoMock);

        render(await Page());

        expect(screen.getByTestId("encabezado-pagina").getAttribute("data-cantidad")).toBe("0");
        expect(screen.getByTestId("contenedor-publicaciones").getAttribute("data-cantidad")).toBe("0");
    });

    it.each([
        { descripcion: "undefined", resultado: undefined },
        { descripcion: "null", resultado: null },
        { descripcion: "un objeto sin publicaciones", resultado: {} },
        { descripcion: "publicaciones null", resultado: { publicaciones: null } },
        { descripcion: "publicaciones undefined", resultado: { publicaciones: undefined } },
    ])("usa una lista vacía cuando el resultado es $descripcion", async ({ resultado }) => {
        vi.mocked(obtenerPublicaciones).mockResolvedValue(resultado as unknown as ResultadoMock);

        render(await Page());

        expect(screen.getByTestId("encabezado-pagina").getAttribute("data-cantidad")).toBe("0");
        expect(screen.getByTestId("contenedor-publicaciones").getAttribute("data-cantidad")).toBe("0");
    });

    it.each(["/inicio", "/iniciar-sesion"])("no consulta publicaciones cuando el control redirige a %s", async (ruta) => {
        vi.mocked(requerirConsultaProductores).mockRejectedValue(new Error(`NEXT_REDIRECT:${ruta}`));
        await expect(Page()).rejects.toThrow(`NEXT_REDIRECT:${ruta}`);
        expect(obtenerPublicaciones).not.toHaveBeenCalled();
    });

    it("propaga el error al obtener la sesión sin consultar publicaciones", async () => {
        vi.mocked(requerirConsultaProductores).mockRejectedValue(new Error("No se pudo validar la sesión"));
        await expect(Page()).rejects.toThrow("No se pudo validar la sesión");
        expect(obtenerPublicaciones).not.toHaveBeenCalled();
    });

    it("propaga los errores de la consulta de publicaciones", async () => {
        vi.mocked(obtenerPublicaciones).mockRejectedValue(new Error("Error consultando publicaciones"));

        await expect(Page()).rejects.toThrow("Error consultando publicaciones");
        expect(obtenerPublicaciones).toHaveBeenCalledWith(sesionOperador);
    });
});
