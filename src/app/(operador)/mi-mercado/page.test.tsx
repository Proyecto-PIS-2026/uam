// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    obtenerOperadorActual: vi.fn(),
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
    obtenerSesion: vi.fn(),
}));

vi.mock("../../../modulos/usuarios/operadores/operador-actual", () => ({
    obtenerOperadorActual: mocks.obtenerOperadorActual,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.obtenerSesion }));
vi.mock("@/modulos/publicaciones/mi-mercado/componentes/VistaMiMercado", () => ({ default: vi.fn() }));

import Page from "./page";
import VistaMiMercado from "@/modulos/publicaciones/mi-mercado/componentes/VistaMiMercado";
import * as autorizacion from "@/modulos/identidad-acceso/autorizacion/permisos";

describe("/mi-mercado", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
    });

    it("redirige al operador autenticado", async () => {
        mocks.obtenerOperadorActual.mockResolvedValue({ id: 13, nombreFantasia: "Frutas & Más" });

        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");

        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/mi-mercado/Frutas%20%26%20M%C3%A1s");
    });

    it("redirige al login antes de consultar operadores si no hay sesión", async () => {
        mocks.obtenerSesion.mockResolvedValue(null);
        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/sesion-finalizada");
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
    });

    it("muestra Mi Mercado sin redirigir al segmento reservado productor", async () => {
        mocks.obtenerOperadorActual.mockResolvedValue({ id: 13, nombreFantasia: "productor" });

        const vista = await Page();

        expect(vista.type).toBe(VistaMiMercado);
        expect(vista.props).toEqual({});
        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("no redirige si no hay operadores", async () => {
        mocks.obtenerOperadorActual.mockRejectedValue(new Error("No se encontr\u00f3 ning\u00fan operador de Mi Mercado."));

        await expect(Page()).rejects.toThrow("No se encontr\u00f3 ning\u00fan operador de Mi Mercado.");
        expect(mocks.redirect).not.toHaveBeenCalled();
    });
});

describe("acceso no autorizado a Mi Mercado", () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([
        { rol: "PRODUCTOR", destino: "/mi-mercado/productor" },
        { rol: "ADMINISTRADOR", destino: "/inicio" },
    ] as const)("rechaza el acceso del rol $rol", async ({ rol, destino }) => {
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 });
        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith(destino);
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
    });

    it("mantiene el inicio de sesión para visitantes", async () => {
        mocks.obtenerSesion.mockResolvedValue(null);
        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/sesion-finalizada");
    });

    it("comprueba el permiso antes de consultar el operador", async () => {
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        const regla = vi.spyOn(autorizacion, "autorizado").mockReturnValue(false);
        try {
            await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
            expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/inicio");
            expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
        } finally {
            regla.mockRestore();
        }
    });
});
