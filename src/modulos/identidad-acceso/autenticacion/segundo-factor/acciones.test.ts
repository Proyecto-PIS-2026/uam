// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelarVerificacion, verificarSegundoFactor } from "./acciones";

const mocks = vi.hoisted(() => ({
    confirmar: vi.fn(), cancelar: vi.fn(), obtenerToken: vi.fn(), borrarCookie: vi.fn(), crearSesion: vi.fn(), cerrarSesion: vi.fn(), redirect: vi.fn(),
}));
vi.mock("@/modulos/identidad-acceso/autenticacion/segundo-factor/segundo-factor", () => ({ confirmarSegundoFactor: mocks.confirmar, cancelarSegundoFactor: mocks.cancelar }));
vi.mock("@/modulos/identidad-acceso/autenticacion/segundo-factor/cookie-segundo-factor", () => ({ obtenerTokenSegundoFactor: mocks.obtenerToken, borrarCookieSegundoFactor: mocks.borrarCookie }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ crearSesion: mocks.crearSesion, cerrarSesion: mocks.cerrarSesion }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

beforeEach(() => {
    vi.resetAllMocks();
    mocks.obtenerToken.mockResolvedValue("token-servidor");
    mocks.redirect.mockImplementation((ruta: string) => { throw new Error(ruta); });
});

function formulario(codigo = "123456") {
    const datos = new FormData();
    datos.set("codigo", codigo);
    datos.set("usuarioId", "999");
    return datos;
}

describe("acciones del segundo factor", () => {
    it("avisa que faltan los datos si no recibe la cookie y no intenta confirmar ni crear sesión", async () => {
        mocks.obtenerToken.mockResolvedValue("");

        await expect(verificarSegundoFactor({}, formulario())).rejects.toThrow("/iniciar-sesion?segundoFactor=sin-datos");

        expect(mocks.confirmar).not.toHaveBeenCalled();
        expect(mocks.crearSesion).not.toHaveBeenCalled();
        expect(mocks.borrarCookie).toHaveBeenCalledOnce();
        expect(mocks.cerrarSesion).toHaveBeenCalledOnce();
    });

    it("emite una sesión solamente para el usuario confirmado en el servidor", async () => {
        mocks.confirmar.mockResolvedValue({ usuarioId: 7, versionSegundoFactor: "version-confirmada" });
        await expect(verificarSegundoFactor({}, formulario())).rejects.toThrow("/inicio");
        expect(mocks.confirmar).toHaveBeenCalledWith("token-servidor", "123456");
        expect(mocks.crearSesion).toHaveBeenCalledWith(7, "ADMINISTRADOR", "version-confirmada");
        expect(mocks.borrarCookie).toHaveBeenCalledOnce();
    });

    it("no crea una sesión con un código incorrecto", async () => {
        mocks.confirmar.mockResolvedValue({ error: "Código incorrecto" });
        expect(await verificarSegundoFactor({}, formulario())).toEqual({ error: "Código incorrecto" });
        expect(mocks.crearSesion).not.toHaveBeenCalled();
        expect(mocks.borrarCookie).not.toHaveBeenCalled();
    });

    it.each([[null, "interrumpido"], [{ bloqueado: true }, "bloqueado"]])("regresa al login y elimina las cookies cuando el resultado es %j", async (resultado, motivo) => {
        mocks.confirmar.mockResolvedValue(resultado);
        await expect(verificarSegundoFactor({}, formulario())).rejects.toThrow(`/iniciar-sesion?segundoFactor=${motivo}`);
        expect(mocks.crearSesion).not.toHaveBeenCalled();
        expect(mocks.borrarCookie).toHaveBeenCalled();
        expect(mocks.cerrarSesion).toHaveBeenCalled();
    });

    it("cancelar invalida el pendiente y vuelve al login con un mensaje", async () => {
        await expect(cancelarVerificacion()).rejects.toThrow("/iniciar-sesion?segundoFactor=cancelado");
        expect(mocks.cancelar).toHaveBeenCalledWith("token-servidor");
        expect(mocks.borrarCookie).toHaveBeenCalled();
        expect(mocks.cerrarSesion).toHaveBeenCalled();
        expect(mocks.crearSesion).not.toHaveBeenCalled();
    });

    it("permite cancelar aunque la cookie ya no esté disponible", async () => {
        mocks.obtenerToken.mockResolvedValue("");

        await expect(cancelarVerificacion()).rejects.toThrow("/iniciar-sesion?segundoFactor=cancelado");

        expect(mocks.borrarCookie).toHaveBeenCalledOnce();
        expect(mocks.cerrarSesion).toHaveBeenCalledOnce();
        expect(mocks.confirmar).not.toHaveBeenCalled();
        expect(mocks.crearSesion).not.toHaveBeenCalled();
    });
});
