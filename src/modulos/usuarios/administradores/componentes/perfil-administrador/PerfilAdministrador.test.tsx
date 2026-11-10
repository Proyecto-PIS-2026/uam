import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import PerfilAdministrador, { RUTA_MI_PERFIL } from "./PerfilAdministrador";
import type { PerfilAdministrador as DatosPerfilAdministrador } from "../../acciones/consultas-perfil-administrador";

const mocks = vi.hoisted(() => ({ restablecer: vi.fn(), refresh: vi.fn(), notificar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("../../restablecerSegundoFactorAdministrador", () => ({ restablecerSegundoFactorAdministrador: mocks.restablecer }));
vi.mock("@/compartido/componentes/NotificacionToast", () => ({ useNotificacionToast: () => ({ notificar: mocks.notificar }) }));

const administradorBase: DatosPerfilAdministrador = {
    id: 101,
    usuarioId: 1,
    nombreUsuario: "ana.admin",
    email: "ana@example.com",
    segundoFactorActivado: true,
    solicitoRestablecimiento: false,
};

function renderizar(cambios: Partial<DatosPerfilAdministrador> = {}, esPropiaCuenta = false) {
    render(<PerfilAdministrador administrador={{ ...administradorBase, ...cambios }} esPropiaCuenta={esPropiaCuenta} />);
}

describe("PerfilAdministrador", () => {
    beforeEach(() => { vi.resetAllMocks(); });
    afterEach(() => {
        cleanup();
    });

    it("muestra el nombre de usuario, la inicial y el correo", () => {
        renderizar();

        expect(screen.getByRole("heading", { level: 1, name: "ana.admin" })).toBeInTheDocument();
        expect(screen.getByText("A")).toBeInTheDocument();
        expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    });

    it.each([
        { segundoFactorActivado: true, texto: "Activado" },
        { segundoFactorActivado: false, texto: "No configurado" },
    ])("indica el segundo factor: $texto", ({ segundoFactorActivado, texto }) => {
        renderizar({ segundoFactorActivado });

        expect(screen.getByText(texto)).toBeInTheDocument();
    });

    it.each([
        { solicitoRestablecimiento: true, texto: "Solicitado" },
        { solicitoRestablecimiento: false, texto: "No solicitado" },
    ])("indica el restablecimiento de contraseña: $texto", ({ solicitoRestablecimiento, texto }) => {
        renderizar({ solicitoRestablecimiento });

        expect(screen.getByText(texto)).toBeInTheDocument();
    });

    it("ofrece volver al listado", () => {
        renderizar();

        expect(screen.getByRole("link", { name: /Volver al listado de administradores/ })).toHaveAttribute("href", "/administracion#usuarios");
    });

    describe("perfil de otro administrador", () => {
        it("ofrece editar la cuenta consultada", () => {
            renderizar();

            expect(screen.getByRole("link", { name: "Editar administrador" })).toHaveAttribute("href", "/gestion-administradores/101/editar");
        });

        it("solicita confirmación y cancelar no restablece el segundo factor", async () => {
            renderizar();

            const restablecer = screen.getByRole("button", { name: "Restablecer segundo factor" });
            expect(restablecer).toBeEnabled();
            expect(screen.queryByRole("link", { name: "Configurar segundo factor" })).not.toBeInTheDocument();
            fireEvent.click(restablecer);
            fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
            expect(mocks.restablecer).not.toHaveBeenCalled();
        });

        it("confirma el restablecimiento de la cuenta consultada y actualiza el perfil", async () => {
            mocks.restablecer.mockResolvedValue({ esValido: true, mensaje: "Segundo factor restablecido." });
            renderizar();
            fireEvent.click(screen.getByRole("button", { name: "Restablecer segundo factor" }));
            fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restablecer" }));
            await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
            expect(mocks.restablecer).toHaveBeenCalledExactlyOnceWith(101);
            expect(mocks.notificar).toHaveBeenCalledWith("Segundo factor restablecido.", "success");
        });

        it("muestra un error y permite reintentar si el servidor rechaza el restablecimiento", async () => {
            mocks.restablecer.mockResolvedValue({ esValido: false, errores: ["No podés restablecer tu propio segundo factor."] });
            renderizar();
            fireEvent.click(screen.getByRole("button", { name: "Restablecer segundo factor" }));
            fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restablecer" }));
            await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("No podés restablecer tu propio segundo factor.", "error"));
            expect(mocks.refresh).not.toHaveBeenCalled();
            expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Restablecer" })).toBeEnabled();
        });
    });

    describe("propia cuenta", () => {
        it("lleva Editar a Mi perfil", () => {
            renderizar({}, true);

            expect(screen.getByRole("link", { name: "Editar mi perfil" })).toHaveAttribute("href", RUTA_MI_PERFIL);
            expect(screen.queryByRole("link", { name: "Editar administrador" })).not.toBeInTheDocument();
        });

        it("ofrece configurar el segundo factor desde Mi perfil y no restablecerlo", () => {
            renderizar({}, true);

            expect(screen.getByRole("link", { name: "Configurar segundo factor" })).toHaveAttribute("href", RUTA_MI_PERFIL);
            expect(screen.queryByRole("button", { name: "Restablecer segundo factor" })).not.toBeInTheDocument();
        });
    });
});
