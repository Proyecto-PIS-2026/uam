// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    obtenerOperadorActual: vi.fn(),
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

vi.mock("../../../modulos/usuarios/operadores/operador-actual", () => ({
    obtenerOperadorActual: mocks.obtenerOperadorActual,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import Page from "./page";

describe("/mi-mercado", () => {
    beforeEach(() => vi.clearAllMocks());

    it("redirige al primer operador disponible", async () => {
        mocks.obtenerOperadorActual.mockResolvedValue({ id: 13 });

        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");

        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/mi-mercado/13");
    });

    it("no redirige si no hay operadores", async () => {
        mocks.obtenerOperadorActual.mockRejectedValue(new Error("No se encontr\u00f3 ning\u00fan operador de Mi Mercado."));

        await expect(Page()).rejects.toThrow("No se encontr\u00f3 ning\u00fan operador de Mi Mercado.");
        expect(mocks.redirect).not.toHaveBeenCalled();
    });
});
