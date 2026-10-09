// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const sesionMock = vi.hoisted(() => vi.fn());
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: sesionMock }));

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
    beforeEach(() => { vi.clearAllMocks(); sesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 }); });

    it("redirige al primer operador disponible", async () => {
        mocks.obtenerOperadorActual.mockResolvedValue({ id: 13, nombreFantasia: "Frutas & Más" });

        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");

        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/mi-mercado/Frutas%20%26%20M%C3%A1s");
    });

    it("no redirige si no hay operadores", async () => {
        mocks.obtenerOperadorActual.mockRejectedValue(new Error("No se encontr\u00f3 ning\u00fan operador de Mi Mercado."));

        await expect(Page()).rejects.toThrow("No se encontr\u00f3 ning\u00fan operador de Mi Mercado.");
        expect(mocks.redirect).not.toHaveBeenCalled();
    });
});

describe("acceso no autorizado a Mi Mercado", () => {
    beforeEach(() => vi.clearAllMocks());

    it.each(["PRODUCTOR", "ADMINISTRADOR"] as const)("rechaza el acceso del rol %s", async (rol) => {
        sesionMock.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 });
        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/inicio");
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
    });

    it("mantiene el inicio de sesión para visitantes", async () => {
        sesionMock.mockResolvedValue(null);
        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/iniciar-sesion");
    });
});
