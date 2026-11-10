import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import Page from "./page";

const mocks = vi.hoisted(() => ({
    requerirAdministrador: vi.fn(),
    obtenerPerfil: vi.fn(),
    notFound: vi.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
    }),
    redirect: vi.fn(() => {
        throw new Error("NEXT_REDIRECT");
    }),
    propsPerfil: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    requerirAdministrador: mocks.requerirAdministrador,
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));

vi.mock("@/modulos/usuarios/administradores/acciones/consultas-perfil-administrador", () => ({
    obtenerPerfilAdministrador: mocks.obtenerPerfil,
}));

vi.mock("@/modulos/usuarios/administradores/componentes/perfil-administrador/PerfilAdministrador", () => ({
    default: (props: unknown) => {
        mocks.propsPerfil(props);
        return <div data-testid="perfil" />;
    },
}));

function props(id: string) {
    return { params: Promise.resolve({ id }) };
}

const perfil = { id: 101, usuarioId: 1, nombreUsuario: "admin123" };

describe("Página de perfil de un administrador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Quien consulta es el usuario 7, no el consultado
        mocks.requerirAdministrador.mockResolvedValue({ usuarioId: 7, rol: "ADMINISTRADOR" });
        mocks.obtenerPerfil.mockResolvedValue(perfil);
    });

    afterEach(() => {
        cleanup();
    });

    it("no consulta el perfil si la autorización falla", async () => {
        mocks.requerirAdministrador.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

        await expect(Page(props("101"))).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.obtenerPerfil).not.toHaveBeenCalled();
    });

    it("muestra el perfil de otra cuenta", async () => {
        render(await Page(props("101")));

        expect(mocks.obtenerPerfil).toHaveBeenCalledWith(101);
        expect(screen.getByTestId("perfil")).toBeInTheDocument();
        expect(mocks.propsPerfil).toHaveBeenLastCalledWith({ administrador: perfil, esPropiaCuenta: false });
        expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("redirige a Mi perfil cuando se consulta la propia cuenta por URL", async () => {
        mocks.requerirAdministrador.mockResolvedValue({ usuarioId: 1, rol: "ADMINISTRADOR" });

        await expect(Page(props("101"))).rejects.toThrow("NEXT_REDIRECT");

        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/mi-perfil");
        expect(mocks.propsPerfil).not.toHaveBeenCalled();
    });

    it("llama a notFound si el administrador no existe", async () => {
        mocks.obtenerPerfil.mockResolvedValue(null);

        await expect(Page(props("999"))).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mocks.notFound).toHaveBeenCalledOnce();
    });
});
