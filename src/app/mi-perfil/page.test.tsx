import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Pagina from "./page";

const m = vi.hoisted(() => ({
    sesion: vi.fn(),
    habilitado: vi.fn(),
    redirect: vi.fn(),
    obtenerPerfilAdmin: vi.fn(),
    obtenerPerfilOperador: vi.fn(),
    perfilOperador: vi.fn(() => null),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: m.sesion }));
vi.mock("@/modulos/identidad-acceso/cambio-contrasena/configuracion", () => ({ get habilitarCambioContrasena() { return m.habilitado(); } }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/modulos/usuarios/administradores/consultar-mi-perfil", () => ({ consultarMiPerfilAdministrador: m.obtenerPerfilAdmin }));
vi.mock("@/modulos/usuarios/operadores/consultasPerfilPropio", () => ({ obtenerPerfilPropioOperador: m.obtenerPerfilOperador }));
vi.mock("@/modulos/usuarios/operadores/componentes/perfil-propio-operador/PerfilPropioOperador", () => ({ default: m.perfilOperador }));

describe("BP-11.1: página de consulta de mi perfil", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        m.sesion.mockResolvedValue({ usuarioId: 7, rol: "ADMINISTRADOR" });
        m.habilitado.mockReturnValue(true);
        m.obtenerPerfilAdmin.mockResolvedValue({ nombre: "admin7", correo: "admin7@uam.com" });
        m.obtenerPerfilOperador.mockResolvedValue({ id: 13, nombre: "Operador" });
        m.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
    });

    it("carga exclusivamente el perfil asociado a la sesión y muestra nombre y correo", async () => {
        render(await Pagina());
        expect(m.obtenerPerfilAdmin).toHaveBeenCalledExactlyOnceWith(7);
        expect(screen.getByText("admin7")).toBeInTheDocument();
        expect(screen.getByText("admin7@uam.com")).toBeInTheDocument();
        expect(screen.queryByText(/passwordHash|twoFactorSecret/i)).not.toBeInTheDocument();
    });

    it("ofrece editar la cuenta y cambiar la contraseña cuando está permitido", async () => {
        render(await Pagina());
        expect(screen.getByRole("link", { name: "Editar mi perfil" })).toHaveAttribute("href", "/mi-perfil/editar");
        expect(screen.getByRole("link", { name: "Cambiar contraseña" })).toHaveAttribute("href", "/mi-perfil/cambiar-contrasena");
    });

    it("CA-7: muestra el botón de configurar 2FA sin habilitar una acción", async () => {
        render(await Pagina());
        const boton = screen.getByRole("button", { name: "Configurar segundo factor" });
        expect(boton).toBeVisible();
        expect(boton).toBeDisabled();
    });

    it("no ofrece el cambio de contraseña si no está habilitado", async () => {
        m.habilitado.mockReturnValue(false);
        render(await Pagina());
        expect(screen.queryByRole("link", { name: "Cambiar contraseña" })).not.toBeInTheDocument();
    });

    it("informa cuando el perfil no se encuentra, sin mostrar datos ajenos", async () => {
        m.obtenerPerfilAdmin.mockResolvedValue(null);
        render(await Pagina());
        expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron encontrar los datos de tu perfil");
        expect(screen.queryByRole("link", { name: "Editar mi perfil" })).not.toBeInTheDocument();
    });

    it("propaga los errores de lectura al límite de error de la ruta", async () => {
        m.obtenerPerfilAdmin.mockRejectedValue(new Error("DB no disponible"));
        await expect(Pagina()).rejects.toThrow("DB no disponible");
    });

    it("mantiene el perfil propio del operador", async () => {
        m.sesion.mockResolvedValue({ usuarioId: 7, rol: "OPERADOR" });
        render(await Pagina());
        expect(m.obtenerPerfilOperador).toHaveBeenCalledOnce();
        expect(m.perfilOperador).toHaveBeenCalledWith({ perfil: { id: 13, nombre: "Operador" } }, undefined);
        expect(m.obtenerPerfilAdmin).not.toHaveBeenCalled();
    });

    it("redirige al productor sin consultar administradores", async () => {
        m.sesion.mockResolvedValue({ usuarioId: 7, rol: "PRODUCTOR" });
        await expect(Pagina()).rejects.toThrow("NEXT_REDIRECT");
        expect(m.redirect).toHaveBeenCalledWith("/mi-perfil/productor");
        expect(m.obtenerPerfilAdmin).not.toHaveBeenCalled();
    });

    it("redirige sin sesión antes de leer datos", async () => {
        m.sesion.mockResolvedValue(null);
        await expect(Pagina()).rejects.toThrow("NEXT_REDIRECT");
        expect(m.redirect).toHaveBeenCalledWith("/sesion-finalizada");
        expect(m.obtenerPerfilAdmin).not.toHaveBeenCalled();
    });
});
