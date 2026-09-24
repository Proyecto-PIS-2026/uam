import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PerfilPublicoOperador } from "../../../../modulos/usuarios/operadores/consultas-perfil-publico";
import Page from "./page";

// Creo dos funciones falsas de obtener perfil y el notfound
const mocks = vi.hoisted(() => ({
    obtenerPerfil: vi.fn(),
    notFound: vi.fn(() => {
        throw new Error("PERFIL_NO_ENCONTRADO");
    }),
}));

// Reemplaza el import de la pagina por mi funcion falsa
vi.mock("../../../../modulos/usuarios/operadores/consultas-perfil-publico", () => ({
    obtenerPerfilPublicoOperador: mocks.obtenerPerfil,
}));

// Reemplaza el import de la pagina por mi otra funcion falsa
vi.mock("next/navigation", () => ({
    notFound: mocks.notFound,
}));

// Reemplazar Image de next por un img comun
vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({ src, alt }: { src: string; alt: string }) =>
            createElement("img", { src, alt }),
    };
});

// Datos de prueba
const perfil: PerfilPublicoOperador = {
    id: 13,
    nombreFantasia: "Frutas del Norte",
    fotoPerfil: null,
    whatsApp: "+59899100001",
    locales: [{ numeroLocal: "18", nombreNave: "B" }],
    publicaciones: [{
        id: 101,
        foto: null,
        precio: "120",
        especie: "Tomate",
        variedad: "Perita",
        presentacion: "Cajón",
        categoria: "Extra",
        calibre: "A",
    }],
};

describe("Página pública del operador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("consulta el operador indicado en la URL y muestra su perfil y catálogo", async () => {
        mocks.obtenerPerfil.mockResolvedValue(perfil);

        const contenido = await Page({
            params: Promise.resolve({ id: "13" }),
        });
        render(contenido);

        expect(mocks.obtenerPerfil).toHaveBeenCalledWith(13);
        expect(mocks.notFound).not.toHaveBeenCalled();
        expect(screen.getByRole("main")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Frutas del Norte" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Productos" })).toBeInTheDocument();
        expect(screen.getByText("Tomate - Perita")).toBeInTheDocument();
    });

    it("llama a notFound cuando el operador no existe", async () => {
        mocks.obtenerPerfil.mockResolvedValue(null);

        await expect(Page({ params: Promise.resolve({ id: "999" }) })).rejects.toThrow("PERFIL_NO_ENCONTRADO");

        expect(mocks.obtenerPerfil).toHaveBeenCalledWith(999);
        expect(mocks.notFound).toHaveBeenCalledOnce();
    });
});