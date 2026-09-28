import { beforeEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.hoisted(() => vi.fn(() => { throw new Error("NOT_FOUND"); }));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
vi.mock("../../../../modulos/publicaciones/mi-mercado/componentes/VistaMiMercado", () => ({
    default: vi.fn(() => null),
}));

import Page from "./page";

describe("/mi-mercado/[id]", () => {
    beforeEach(() => vi.clearAllMocks());

    it("pasa el ID del operador a Mi Mercado", async () => {
        const contenido = await Page({ params: Promise.resolve({ id: "13" }) });
        expect(contenido.props.operadorId).toBe(13);
        expect(notFoundMock).not.toHaveBeenCalled();
    });

    it.each(["abc", "0", "-1", "1.5", "1e3", "0x16", "9007199254740992"])("rechaza el ID inválido %s", async (id) => {
        await expect(Page({ params: Promise.resolve({ id }) })).rejects.toThrow("NOT_FOUND");
        expect(notFoundMock).toHaveBeenCalledOnce();
    });
});
