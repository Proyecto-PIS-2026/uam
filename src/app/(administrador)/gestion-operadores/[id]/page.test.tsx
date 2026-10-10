import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import Page from "./page";

const mocks = vi.hoisted(() => ({
    obtenerPerfil: vi.fn(),
    obtenerOpciones: vi.fn(),
    // El notFound real corta la ejecución lanzando un error; el falso hace lo mismo
    notFound: vi.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
    }),
    propsPerfil: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

vi.mock("../../../../modulos/usuarios/operadores/consultas-perfil-admin", () => ({
    obtenerPerfilAdminOperador: mocks.obtenerPerfil,
}));

vi.mock("../../../../modulos/publicaciones/operadores/consultas-edicion-publicacion", () => ({
    obtenerOpcionesEdicionPublicacion: mocks.obtenerOpciones,
}));

vi.mock("../../../../modulos/usuarios/operadores/componentes/perfil-admin-operador/PerfilOperadorAdmin", () => ({
    default: (props: unknown) => {
        mocks.propsPerfil(props);
        return <div data-testid="perfil" />;
    },
}));

// Arma las props que Next.js le pasa a la página con el id de la URL
function props(id: string) {
    return { params: Promise.resolve({ id }) };
}

const perfil = { id: 12, nombreFantasia: "Operador de Prueba" };
const opciones = { especies: [], variedades: [], presentaciones: [], categorias: [], calibres: [], paises: [] };

describe("Página de perfil del operador para el administrador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerPerfil.mockResolvedValue(perfil);
        mocks.obtenerOpciones.mockResolvedValue(opciones);
    });

    afterEach(() => {
        cleanup();
    });

    // Con un operador existente muestra su perfil con el catálogo
    it("muestra el perfil del operador con las opciones del catálogo", async () => {
        render(await Page(props("12")));

        expect(mocks.obtenerPerfil).toHaveBeenCalledWith(12);
        expect(mocks.obtenerOpciones).toHaveBeenCalledOnce();
        expect(screen.getByTestId("perfil")).toBeInTheDocument();
        expect(mocks.propsPerfil).toHaveBeenLastCalledWith({ operador: perfil, opciones });
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    // Con un operador inexistente muestra la página 404
    it("llama a notFound si el operador no existe", async () => {
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