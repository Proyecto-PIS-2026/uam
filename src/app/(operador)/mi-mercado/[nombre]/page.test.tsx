import { beforeEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.hoisted(() => vi.fn(() => { throw new Error("NOT_FOUND") }));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
vi.mock("../../../../modulos/publicaciones/mi-mercado/componentes/VistaMiMercado", () => ({
    default: vi.fn(() => null),
}));

import Page from "./page";

describe("/mi-mercado/[nombre]", () => {
    beforeEach(() => vi.clearAllMocks());

    it.each(["Jorge Ferias", "Frutas & Más", "Frutas 100%", "Frutas %20", "%", "%ZZ", "%C3"])("recupera el nombre original del segmento codificado: %s", async (nombre) => {
        const contenido = await Page({ params: Promise.resolve({ nombre: encodeURIComponent(nombre) }) });
        expect(contenido.props.operadorNombre).toBe(nombre);
        expect(notFoundMock).not.toHaveBeenCalled();
    });

    it.each(["", "   "])("rechaza el nombre vacío %s", async (nombre) => {
        await expect(Page({ params: Promise.resolve({ nombre: encodeURIComponent(nombre) }) })).rejects.toThrow("NOT_FOUND");
        expect(notFoundMock).toHaveBeenCalledOnce();
    });

    it("entrega a la vista la publicación validada del aviso", async () => {
        const contenido = await Page({ params: Promise.resolve({ nombre: "Frutas" }), searchParams: Promise.resolve({ publicacion: "123" }) });

        expect(contenido.props).toEqual({ operadorNombre: "Frutas", publicacionInicialId: 123 });
    });

    it.each(["-1", "1.5", "2147483648", ["1", "2"]].map((publicacion) => ({ publicacion })))("ignora una publicación inválida $publicacion", async ({ publicacion }) => {
        const contenido = await Page({ params: Promise.resolve({ nombre: "Frutas" }), searchParams: Promise.resolve({ publicacion }) });

        expect(contenido.props.publicacionInicialId).toBeNull();
    });
});
