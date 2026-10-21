import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Page from "./page";

const mocks = vi.hoisted(() => ({
    requerirAdministrador: vi.fn(),
    obtenerPerfil: vi.fn(),
    // El notFound real corta la ejecución lanzando un error; el falso hace lo mismo
    notFound: vi.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
    }),
    propsPerfil: vi.fn(),
}));
 
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    requerirAdministrador: mocks.requerirAdministrador,
}));
 
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
 
vi.mock("@/modulos/usuarios/productores/acciones/consultas-perfil-productor-admin", () => ({
    obtenerPerfilAdminProductor: mocks.obtenerPerfil,
}));
 
vi.mock("../../../../modulos/usuarios/productores/componentes/perfil-admin-productor/PerfilProductorAdmin", () => ({
    default: (props: unknown) => {
        mocks.propsPerfil(props);
        return <div data-testid="perfil" />;
    },
}));

function props(id: string) {
    return { params: Promise.resolve({ id }) };
}

const perfil = { id: 2, nombreUsuario: "productor_demo_norte" };

describe("Pagina de perfil del productor para el administrador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requerirAdministrador.mockResolvedValue(undefined);
        mocks.obtenerPerfil.mockResolvedValue(perfil);
    });
 
    afterEach(() => {
        cleanup();
    });

    // Si quien entra no es administrador, no se consulta nada
    it("no consulta el perfil si la autorización falla", async () => {
        mocks.requerirAdministrador.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
 
        await expect(Page(props("2"))).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.obtenerPerfil).not.toHaveBeenCalled();
    });

    // Con un productor existente muestra su perfil
    it("muestra el perfil del productor", async () => {
        render(await Page(props("2")));
 
        expect(mocks.obtenerPerfil).toHaveBeenCalledWith(2);
        expect(screen.getByTestId("perfil")).toBeInTheDocument();
        expect(mocks.propsPerfil).toHaveBeenLastCalledWith({ productor: perfil });
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    // Con un productor inexistente muestra la página 404
    it("llama a notFound si el productor no existe", async () => {
        mocks.obtenerPerfil.mockResolvedValue(null);
 
        await expect(Page(props("99999"))).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mocks.notFound).toHaveBeenCalledOnce();
        expect(mocks.propsPerfil).not.toHaveBeenCalled();
    });

    // Un id que no es número llega como NaN; la consulta lo rechaza y se muestra 404
    it("convierte el id de la URL a número y responde 404 si no es válido", async () => {
        mocks.obtenerPerfil.mockResolvedValue(null);
 
        await expect(Page(props("abc"))).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mocks.obtenerPerfil).toHaveBeenCalledWith(Number.NaN);
        expect(mocks.notFound).toHaveBeenCalledOnce();
    });

});