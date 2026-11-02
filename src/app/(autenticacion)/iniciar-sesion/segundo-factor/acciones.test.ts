// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelarVerificacion, verificarSegundoFactor } from "./acciones";

const mocks = vi.hoisted(() => ({
    confirmar: vi.fn(), cancelar: vi.fn(), borrarCookie: vi.fn(), crearSesion: vi.fn(), cerrarSesion: vi.fn(), redirect: vi.fn(),
}));
vi.mock("@/modulos/identidad-acceso/autenticacion/segundo-factor", () => ({ confirmarSegundoFactor: mocks.confirmar, cancelarSegundoFactor: mocks.cancelar }));
vi.mock("@/modulos/identidad-acceso/autenticacion/cookie-segundo-factor", () => ({ obtenerTokenSegundoFactor: vi.fn(async () => "token-servidor"), borrarCookieSegundoFactor: mocks.borrarCookie }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ crearSesion: mocks.crearSesion, cerrarSesion: mocks.cerrarSesion }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

beforeEach(() => {
    vi.resetAllMocks();
    mocks.redirect.mockImplementation((ruta: string) => { throw new Error(ruta); });
});

function formulario(codigo = "123456") {
    const datos = new FormData();
    datos.set("codigo", codigo);
    datos.set("usuarioId", "999");
    return datos;
}

describe("acciones del segundo factor", () => {
    it("emite una sesión solamente para el usuario confirmado en el servidor", async () => {
        mocks.confirmar.mockResolvedValue({ usuarioId: 7 });
        await expect(verificarSegundoFactor({}, formulario())).rejects.toThrow("/inicio");
        expect(mocks.confirmar).toHaveBeenCalledWith("token-servidor", "123456");
        expect(mocks.crearSesion).toHaveBeenCalledWith(7, "ADMINISTRADOR", true);
        expect(mocks.borrarCookie).toHaveBeenCalledOnce();
    });

    it("no crea una sesión con un código incorrecto", async () => {
        mocks.confirmar.mockResolvedValue({ error: "Código incorrecto" });
        expect(await verificarSegundoFactor({}, formulario())).toEqual({ error: "Código incorrecto" });
        expect(mocks.crearSesion).not.toHaveBeenCalled();
        expect(mocks.borrarCookie).not.toHaveBeenCalled();
    });

    it.each([[null, "vencido"], [{ bloqueado: true }, "bloqueado"]])("regresa al login y elimina las cookies cuando el resultado es %j", async (resultado, motivo) => {
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
});
