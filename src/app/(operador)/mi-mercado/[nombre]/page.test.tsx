import { beforeEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.hoisted(() => vi.fn(() => { throw new Error("NOT_FOUND"); }));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
vi.mock("../../../../modulos/publicaciones/mi-mercado/componentes/VistaMiMercado", () => ({
    default: vi.fn(() => null),
}));

import Page from "./page";

describe("/mi-mercado/[nombre]", () => {
    beforeEach(() => vi.clearAllMocks());

    it("pasa el nombre del operador a Mi Mercado", async () => {
        const contenido = await Page({ params: Promise.resolve({ nombre: "Frutas%20%26%20M%C3%A1s" }) });
        expect(contenido.props.operadorNombre).toBe("Frutas & Más");
        expect(notFoundMock).not.toHaveBeenCalled();
    });

    it.each(["", "   "])("rechaza el nombre vacío %s", async (nombre) => {
        await expect(Page({ params: Promise.resolve({ nombre }) })).rejects.toThrow("NOT_FOUND");
        expect(notFoundMock).toHaveBeenCalledOnce();
    });
});
