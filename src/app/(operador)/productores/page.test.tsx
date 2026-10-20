import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Page from "./page";
import PaginaPerfil from "./[nombre]/page";
import ListadoProductores from "@/modulos/usuarios/productores/componentes/ListadoProductores";
import type { PerfilProductor, ProductorListado } from "@/modulos/usuarios/productores/acciones/consultas-productores";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(), listado: vi.fn(), perfil: vi.fn(),
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
    notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.obtenerSesion }));
vi.mock("@/modulos/usuarios/productores/consultas-productores", () => ({
    obtenerProductoresDisponibles: mocks.listado, obtenerPerfilProductor: mocks.perfil,
}));
vi.mock("@/modulos/usuarios/operadores/componentes/perfil-publico-operador/TextoAjustable", () => ({
    default: ({ texto, className }: { texto: string; className?: string }) => <span className={className}>{texto}</span>,
}));

const productores: ProductorListado[] = [
    { id: 1, nombreFantasia: "Zeta", fotoPerfil: "/zeta.webp", cantidadProductos: 2, ubicaciones: ["Salto"] },
    { id: 2, nombreFantasia: "Álamo & Sur", fotoPerfil: null, cantidadProductos: 0, ubicaciones: [] },
];
const perfil: PerfilProductor = {
    id: 2, nombreFantasia: "Álamo & Sur", fotoPerfil: null, whatsApp: "59899123456", ubicaciones: ["Salto"],
    publicaciones: [{ id: 10, foto: null, precio: null, fecha: "2026-10-18T12:00:00Z", cantidadUnidades: 20,
        especie: "Naranja", variedad: "Valencia", presentacion: "KG", categoria: "I", calibre: "M", pais: "Uruguay" }],
};

describe("Listado y navegación de productores", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 5, rol: "OPERADOR", expiraEn: 2000000000 });
        mocks.listado.mockResolvedValue(productores);
        mocks.perfil.mockResolvedValue(perfil);
    });

    it.each([null, "PRODUCTOR", "ADMINISTRADOR"] as const)("impide acceder por URL con la sesión %s", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue(rol ? { usuarioId: 5, rol, expiraEn: 2000000000 } : null);
        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
        await expect(PaginaPerfil({ params: Promise.resolve({ nombre: perfil.nombreFantasia }) })).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.redirect).toHaveBeenCalledWith(rol ? "/inicio" : "/iniciar-sesion");
        expect(mocks.listado).not.toHaveBeenCalled();
        expect(mocks.perfil).not.toHaveBeenCalled();
    });

    it("muestra productores, puntos de retiro y fotos con reemplazo cuando fallan", async () => {
        render(await Page());
        expect(screen.getByRole("heading", { name: "Productores" })).toBeInTheDocument();
        expect(screen.getByText("Salto")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "Foto por defecto de Álamo & Sur" })).toBeInTheDocument();
        fireEvent.error(screen.getByRole("img", { name: "Foto de Zeta" }));
        expect(screen.getByRole("img", { name: "Foto por defecto de Zeta" })).toBeInTheDocument();
    });

    it("busca por nombre ignorando mayúsculas, tildes y espacios externos", () => {
        render(<ListadoProductores productores={productores} />);
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar productores" }), { target: { value: " ALAMO " } });
        expect(screen.getByRole("link")).toHaveAttribute("href", "/productores/%C3%81lamo%20%26%20Sur");
        expect(screen.queryByText("Zeta")).not.toBeInTheDocument();
    });

    it("ordena A-Z y Z-A sin modificar la lista recibida", () => {
        render(<ListadoProductores productores={productores} />);
        expect(screen.getAllByRole("link")[0]).toHaveTextContent("Álamo & Sur");
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("option", { name: "Z-A" }));
        expect(screen.getAllByRole("link")[0]).toHaveTextContent("Zeta");
        expect(productores[0].nombreFantasia).toBe("Zeta");
    });

    it("distingue un listado vacío de una búsqueda sin coincidencias y permite recuperarse", () => {
        const { rerender } = render(<ListadoProductores productores={[]} />);
        expect(screen.getByRole("status")).toHaveTextContent("No hay productores disponibles.");
        rerender(<ListadoProductores productores={productores} />);
        const buscador = screen.getByRole("searchbox", { name: "Buscar productores" });
        fireEvent.change(buscador, { target: { value: "Inexistente" } });
        expect(screen.getByRole("status")).toHaveTextContent("No se encontraron productores que coincidan con la búsqueda.");
        fireEvent.change(buscador, { target: { value: "" } });
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(screen.getAllByRole("link")).toHaveLength(2);
    });

    it("permite ir del listado al perfil, consultar una publicación y regresar", async () => {
        const { unmount } = render(await Page());
        const enlace = screen.getByRole("link", { name: /Álamo & Sur/ });
        const nombre = decodeURIComponent(enlace.getAttribute("href")!.split("/").at(-1)!);
        unmount();
        render(await PaginaPerfil({ params: Promise.resolve({ nombre }) }));
        expect(mocks.perfil).toHaveBeenCalledWith(perfil.nombreFantasia);
        expect(screen.getByRole("heading", { name: perfil.nombreFantasia })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Puntos de retiro" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Naranja - Valencia" }));
        const detalle = within(await screen.findByRole("dialog", { name: "Detalle de publicación" }));
        expect(detalle.getByText("Consultar precio")).toBeInTheDocument();
        expect(detalle.getByText("Uruguay")).toBeInTheDocument();
        expect(detalle.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", expect.stringContaining("https://wa.me/59899123456"));
    });

    it("muestra un perfil sin publicaciones ni puntos de retiro", async () => {
        mocks.perfil.mockResolvedValue({ ...perfil, publicaciones: [], ubicaciones: [] });
        render(await PaginaPerfil({ params: Promise.resolve({ nombre: perfil.nombreFantasia }) }));
        expect(screen.getByText("No hay publicaciones disponibles.")).toBeInTheDocument();
        expect(screen.getByText("Sin puntos de retiro publicados.")).toBeInTheDocument();
    });

    it("devuelve no encontrado para un productor inexistente o no visible", async () => {
        mocks.perfil.mockResolvedValue(null);
        await expect(PaginaPerfil({ params: Promise.resolve({ nombre: "Oculto" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    });
});
