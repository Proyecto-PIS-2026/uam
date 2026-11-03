import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Pagina from "./page";
const m = vi.hoisted(() => ({
    sesion: vi.fn(),
    habilitado: vi.fn(),
    redirect: vi.fn(),
    notFound: vi.fn(),
    where: vi.fn(),
    select: vi.fn(),
    first: vi.fn(),
    obtenerPerfilOperador: vi.fn(),
    perfilOperador: vi.fn(() => null),
}));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: m.sesion }));
vi.mock("@/modulos/identidad-acceso/cambio-contrasena/configuracion", () => ({ get habilitarCambioContrasena() { return m.habilitado() } }));
vi.mock("next/navigation", () => ({ redirect: m.redirect, notFound: m.notFound }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { orm: { public: { Usuario: { where: m.where } } } } }));
vi.mock("@/modulos/usuarios/operadores/consultasPerfilPropio", () => ({ obtenerPerfilPropioOperador: m.obtenerPerfilOperador }));
vi.mock("@/modulos/usuarios/operadores/componentes/perfil-propio-operador/PerfilPropioOperador", () => ({ default: m.perfilOperador }));

describe("acceso al cambio desde mi cuenta", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        m.sesion.mockResolvedValue({ usuarioId: 7, rol: "ADMINISTRADOR" });
        m.habilitado.mockReturnValue(true);
        m.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT") });
        m.notFound.mockImplementation(() => { throw new Error("NO_ENCONTRADO") });
        m.where.mockReturnValue({ select: m.select });
        m.select.mockReturnValue({ first: m.first });
        m.first.mockResolvedValue({ username: "mi_usuario" });
        m.obtenerPerfilOperador.mockResolvedValue({ id: 13, nombre: "Operador" });
    });
    it("el administrador accede desde su cuenta sin consultar credenciales", async () => {
        const rol = "ADMINISTRADOR";
        m.sesion.mockResolvedValue({ usuarioId: 7, rol });
        render(await Pagina());
        expect(screen.getByText("mi_usuario")).toBeInTheDocument();
        expect(m.where).toHaveBeenCalledExactlyOnceWith({ id: 7, rol });
        expect(m.select).toHaveBeenCalledExactlyOnceWith("username");
        expect(screen.getByRole("link", { name: "Cambiar contraseña" })).toHaveAttribute("href", "/mi-perfil/cambiar-contrasena");
    });

    it("el operador accede a su perfil propio", async () => {
        const rol = "OPERADOR";
        m.sesion.mockResolvedValue({ usuarioId: 7, rol });
        render(await Pagina());
        expect(m.obtenerPerfilOperador).toHaveBeenCalledOnce();
        expect(m.perfilOperador).toHaveBeenCalledWith({ perfil: { id: 13, nombre: "Operador" } });
        expect(m.where).not.toHaveBeenCalled();
    });
    it("oculta el enlace si no está habilitado", async () => {
        m.habilitado.mockReturnValue(false);
        render(await Pagina());
        expect(screen.queryByRole("link", { name: "Cambiar contraseña" })).not.toBeInTheDocument();
    });
    it("redirige al Productor a su perfil existente", async () => {
        m.sesion.mockResolvedValue({ usuarioId: 7, rol: "PRODUCTOR" });
        await expect(Pagina()).rejects.toThrow("NEXT_REDIRECT");
        expect(m.redirect).toHaveBeenCalledWith("/mi-perfil/productor");
        expect(m.where).not.toHaveBeenCalled();
    });
    it("redirige sin sesión antes de consultar datos", async () => {
        m.sesion.mockResolvedValue(null);
        await expect(Pagina()).rejects.toThrow("NEXT_REDIRECT");
        expect(m.redirect).toHaveBeenCalledWith("/sesion-finalizada");
        expect(m.where).not.toHaveBeenCalled();
    });
    it("rechaza una cuenta que dejó de existir", async () => {
        m.first.mockResolvedValue(null);
        await expect(Pagina()).rejects.toThrow("NO_ENCONTRADO");
    });
});
