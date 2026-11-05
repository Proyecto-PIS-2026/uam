import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Pagina from "./page";
const m = vi.hoisted(() => ({ sesion: vi.fn(), habilitado: vi.fn(), redirect: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: m.sesion }));
vi.mock("@/modulos/identidad-acceso/cambio-contrasena/configuracion", () => ({ get habilitarCambioContrasena() { return m.habilitado() } }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/modulos/identidad-acceso/cambio-contrasena/FormularioCambioContrasena", () => ({ default: ({ volver }: { volver: string }) => <form aria-label="Cambiar contraseña" data-volver={volver} /> }));

describe("página de cambio de contraseña dentro del perfil", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        m.sesion.mockResolvedValue({ usuarioId: 7, rol: "PRODUCTOR" });
        m.habilitado.mockReturnValue(true);
        m.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT") });
    });
    it.each(["ADMINISTRADOR", "OPERADOR", "PRODUCTOR"])("permite el formulario para %s y vuelve a su perfil", async rol => {
        m.sesion.mockResolvedValue({ usuarioId: 7, rol });
        render(await Pagina());
        const volver = rol === "PRODUCTOR" ? "/mi-perfil/productor" : "/mi-perfil";
        expect(screen.getByRole("form")).toHaveAttribute("data-volver", volver);
        expect(screen.getByRole("link", { name: "Volver a mi perfil" })).toHaveAttribute("href", volver);
    });
    it("sin sesión redirige antes de mostrar información o consultar la habilitación", async () => {
        m.sesion.mockResolvedValue(null);
        await expect(Pagina()).rejects.toThrow("NEXT_REDIRECT");
        expect(m.redirect).toHaveBeenCalledWith("/sesion-finalizada");
        expect(m.habilitado).not.toHaveBeenCalled();
    });
    it("oculta el formulario aunque se acceda por URL si está deshabilitado", async () => {
        m.habilitado.mockReturnValue(false);
        render(await Pagina());
        expect(screen.queryByRole("form")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("no está habilitado");
    });
});
