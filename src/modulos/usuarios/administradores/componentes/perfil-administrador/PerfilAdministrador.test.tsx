import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import PerfilAdministrador, { RUTA_MI_PERFIL } from "./PerfilAdministrador";
import type { PerfilAdministrador as DatosPerfilAdministrador } from "../../acciones/consultas-perfil-administrador";

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

        it("muestra restablecer el segundo factor, deshabilitado hasta integrarse", () => {
            renderizar();

            const restablecer = screen.getByRole("button", { name: "Restablecer segundo factor" });
            expect(restablecer).toBeDisabled();
            expect(restablecer).toHaveAttribute("title", "Próximamente");
            expect(screen.queryByRole("link", { name: "Configurar segundo factor" })).not.toBeInTheDocument();
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