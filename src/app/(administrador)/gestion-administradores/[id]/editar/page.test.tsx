import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

const mocks = vi.hoisted(() => ({
    requerirAdministrador: vi.fn(),
    obtenerAdministrador: vi.fn(),
    notFound: vi.fn(),
    redirect: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    requerirAdministrador: mocks.requerirAdministrador,
}));

vi.mock(
    "@/modulos/usuarios/administradores/componentes/modificar-administrador/obtenerAdministradorParaModificar",
    () => ({ obtenerAdministradorParaModificar: mocks.obtenerAdministrador }),
);

vi.mock(
    "@/modulos/usuarios/administradores/componentes/modificar-administrador/FormularioModificarAdministrador",
    () => ({
        default: ({ administrador }: { administrador: { nombreUsuario: string } }) => (
            <div data-testid="formulario">{administrador.nombreUsuario}</div>
        ),
    }),
);

vi.mock("next/navigation", () => ({
    notFound: mocks.notFound,
    redirect: mocks.redirect,
}));

const administrador = {
    id: 102,
    usuarioId: 2,
    nombreUsuario: "beto.admin",
    email: "beto@ejemplo.com",
};

function parametros(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("página de modificación de un administrador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Quien entra es el usuario 7; el administrador a modificar es el usuario 2
        mocks.requerirAdministrador.mockResolvedValue({ usuarioId: 7, rol: "ADMINISTRADOR" });
        mocks.obtenerAdministrador.mockResolvedValue(administrador);
        mocks.notFound.mockImplementation(() => { throw new Error("NO_ENCONTRADO"); });
        mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
    });

    it("no consulta al administrador sin autorización administrativa", async () => {
        mocks.requerirAdministrador.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

        await expect(Page(parametros("102"))).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.obtenerAdministrador).not.toHaveBeenCalled();
    });

    it("muestra el formulario con los datos del administrador indicado en la URL", async () => {
        render(await Page(parametros("102")));

        expect(mocks.obtenerAdministrador).toHaveBeenCalledWith(102);
        expect(screen.getByTestId("formulario").textContent).toContain("beto.admin");
    });

    it("responde no encontrado si el administrador no existe", async () => {
        mocks.obtenerAdministrador.mockResolvedValue(null);

        await expect(Page(parametros("999"))).rejects.toThrow("NO_ENCONTRADO");
        expect(mocks.notFound).toHaveBeenCalledOnce();
    });

    it("redirige a Mi Perfil si se intenta modificar la propia cuenta", async () => {
        mocks.requerirAdministrador.mockResolvedValue({ usuarioId: 2, rol: "ADMINISTRADOR" });

        await expect(Page(parametros("102"))).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.redirect).toHaveBeenCalledWith("/mi-perfil/administrador/editar");
    });
});