import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Page from "./page";
import PaginaPerfil from "./[nombre]/page";
import ListadoProductores from "@/modulos/usuarios/productores/componentes/listado-productores/ListadoProductores";
import type { ProductorListado } from "@/modulos/usuarios/productores/acciones/consultas-productores";
import type { PerfilProductorPorOperador } from "@/modulos/usuarios/productores/acciones/consultas-perfil-por-operador";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(), listado: vi.fn(), perfil: vi.fn(),
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
    notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.obtenerSesion }));
vi.mock(
    "@/modulos/usuarios/productores/acciones/consultas-productores",
    () => ({
        obtenerProductoresDisponibles: mocks.listado,
    })
);

vi.mock(
    "@/modulos/usuarios/productores/acciones/consultas-perfil-por-operador",
    () => ({
        obtenerPerfilProductorPorOperador: mocks.perfil,
    })
);

const productores: ProductorListado[] = [
    { id: 1, nombreFantasia: "Zeta", fotoPerfil: "/zeta.webp", cantidadProductos: 2, ubicaciones: ["Salto"], departamentos: ["Salto"] },
    { id: 2, nombreFantasia: "Álamo & Sur", fotoPerfil: null, cantidadProductos: 0, ubicaciones: [], departamentos: [] },
];

const perfil: PerfilProductorPorOperador = {
    id: 2,
    nombreFantasia: "Álamo & Sur",
    fotoPerfil: null,
    whatsApp: "59899123456",
    departamentos: ["Salto"],
    publicaciones: [
        {
            id: 10,
            foto: null,
            precio: null,
            fecha: "2026-10-18T12:00:00Z",
            cantidadUnidades: 20,
            especie: "Naranja",
            variedad: "Valencia",
            presentacion: "KG",
            categoria: "I",
            calibre: "M",
            pais: "Uruguay",
            ubicaciones: [
                {
                    id: 1,
                    nombreUbicacion: "Salto",
                    urlMaps: "https://maps.example/salto",
                },
            ],
        },
    ],
};

describe("Listado y navegación de productores", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 5, rol: "OPERADOR", expiraEn: 2000000000 });
        mocks.listado.mockResolvedValue(productores);
        mocks.perfil.mockResolvedValue(perfil);
    });

    it.each([null, "PRODUCTOR"] as const)("impide acceder por URL con la sesión %s", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue(rol ? { usuarioId: 5, rol, expiraEn: 2000000000 } : null);
        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
        await expect(PaginaPerfil({ params: Promise.resolve({ nombre: encodeURIComponent(perfil.nombreFantasia) }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.redirect).toHaveBeenCalledWith(rol ? "/mi-mercado/productor" : "/iniciar-sesion");
        expect(mocks.listado).not.toHaveBeenCalled();
        expect(mocks.perfil).not.toHaveBeenCalled();
    });

    it.each(["OPERADOR", "ADMINISTRADOR"] as const)("permite acceder al listado y al perfil al rol %s", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 5, rol, expiraEn: 2000000000 });
        render(await Page());
        expect(screen.getByRole("link", { name: /Álamo & Sur/ })).toHaveAttribute(
            "href",
            rol === "ADMINISTRADOR"
                ? "/gestion-productores/2"
                : "/productores/%C3%81lamo%20%26%20Sur?origen=productores",
        );
        expect(await PaginaPerfil({ params: Promise.resolve({ nombre: encodeURIComponent(perfil.nombreFantasia) }), searchParams: Promise.resolve({}) })).toBeTruthy();
        expect(mocks.listado).toHaveBeenCalledTimes(1);
        expect(mocks.perfil).toHaveBeenCalledExactlyOnceWith(perfil.nombreFantasia);
        expect(mocks.redirect).not.toHaveBeenCalled();
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    it.each(["Huerta 100%", "Huerta %20", "%", "Álamo & Sur"])("recupera el nombre original del segmento codificado: %s", async (nombre) => {
        mocks.perfil.mockResolvedValue({ ...perfil, nombreFantasia: nombre });
        await PaginaPerfil({ params: Promise.resolve({ nombre: encodeURIComponent(nombre) }), searchParams: Promise.resolve({}) });
        expect(mocks.perfil).toHaveBeenCalledExactlyOnceWith(nombre);
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    it("muestra los productores obtenidos por la consulta", async () => {
        render(await Page());
        expect(mocks.listado).toHaveBeenCalledTimes(1);
        expect(screen.getByText("Productores", { exact: true })).toBeInTheDocument();
        expect(screen.getByText("Zeta")).toBeInTheDocument();
        expect(screen.getByText("Álamo & Sur")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Álamo & Sur/ })).toHaveAttribute("href", "/productores/%C3%81lamo%20%26%20Sur?origen=productores");
    });

    it("busca por nombre ignorando mayúsculas, tildes y espacios externos", () => {
        render(<ListadoProductores productores={productores} />);
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar productores" }), { target: { value: " ALAMO " } });
        expect(screen.getByRole("link")).toHaveAttribute("href", "/productores/%C3%81lamo%20%26%20Sur?origen=productores");
        expect(screen.queryByText("Zeta")).not.toBeInTheDocument();
    });

    it("ordena A-Z y Z-A sin modificar la lista recibida", () => {
        render(<ListadoProductores productores={productores} />);
        expect(screen.getAllByRole("link")[0]).toHaveTextContent("Álamo & Sur");
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("menuitemradio", { name: "Z-A" }));
        expect(screen.getAllByRole("link")[0]).toHaveTextContent("Zeta");
        expect(productores[0].nombreFantasia).toBe("Zeta");
    });

    it("distingue un listado vacío de una búsqueda sin coincidencias y permite recuperarse", () => {
        const { rerender } = render(<ListadoProductores productores={[]} />);
        expect(screen.getByRole("status")).toHaveTextContent("No hay productores disponibles.");
        rerender(<ListadoProductores productores={productores} />);
        const buscador = screen.getByRole("searchbox", { name: "Buscar productores" });
        fireEvent.change(buscador, { target: { value: "Inexistente" } });
        expect(screen.getByRole("status")).toHaveTextContent("No se encontraron productores que coincidan con la búsqueda y el departamento seleccionado.");
        fireEvent.change(buscador, { target: { value: "" } });
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(screen.getAllByRole("link")).toHaveLength(2);
    });

    it("permite seleccionar un productor del listado y consultar su información y publicaciones", async () => {
        const { unmount } = render(await Page());
        const enlace = screen.getByRole("link", { name: /Álamo & Sur/ });
        const destino = new URL(enlace.getAttribute("href")!, "http://localhost");
        const nombreCodificado = destino.pathname.split("/").at(-1)!;
        unmount();
        render(await PaginaPerfil({ params: Promise.resolve({ nombre: nombreCodificado }), searchParams: Promise.resolve({}) }));
        expect(mocks.perfil).toHaveBeenCalledWith(perfil.nombreFantasia);
        expect(screen.getByRole("heading", { name: perfil.nombreFantasia })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Naranja - Valencia" }));
        const detalle = within(await screen.findByRole("dialog", { name: "Detalle de publicación" }));
        expect(detalle.getByText("Puntos de retiro")).toBeInTheDocument();
        expect(detalle.getByRole("link", { name: /Salto/ })).toHaveAttribute("href", "https://maps.example/salto");
        expect(detalle.getByText("Consultar precio")).toBeInTheDocument();
        expect(detalle.getByText("Uruguay")).toBeInTheDocument();
        expect(detalle.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", expect.stringContaining("https://web.whatsapp.com/send?phone=59899123456"));
    });

    it("muestra un perfil sin publicaciones ni puntos de retiro", async () => {
        mocks.perfil.mockResolvedValue({ ...perfil, publicaciones: [], ubicaciones: [] });
        render(await PaginaPerfil({ params: Promise.resolve({ nombre: encodeURIComponent(perfil.nombreFantasia) }), searchParams: Promise.resolve({})}));
        expect(screen.getByText("No hay publicaciones disponibles.")).toBeInTheDocument();
    });

    it("devuelve no encontrado para un productor inexistente o no visible", async () => {
        mocks.perfil.mockResolvedValue(null);
        await expect(PaginaPerfil({ params: Promise.resolve({ nombre: "Oculto" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("ofrece volver a Mercado Producción cuando el perfil se abre desde una publicación", async () => {
        render(
            await PaginaPerfil({
                params: Promise.resolve({
                    nombre: encodeURIComponent(perfil.nombreFantasia),
                }),
                searchParams: Promise.resolve({
                    origen: "publicaciones",
                }),
            })
        );
        expect(mocks.perfil).toHaveBeenCalledWith(perfil.nombreFantasia);
        expect(screen.getByRole("link", {name: "Volver a Mercado Producción"})).toHaveAttribute("href", "/publicaciones-productor");
    });
});
