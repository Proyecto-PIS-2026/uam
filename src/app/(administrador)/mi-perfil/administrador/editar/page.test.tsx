import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requerirAdministrador: vi.fn(),
    obtenerPerfil: vi.fn(),
    notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ requerirAdministrador: mocks.requerirAdministrador }));
vi.mock("@/modulos/usuarios/administradores/acciones/consultas-perfil-administrador", () => ({
    obtenerPerfilAdministradorPorUsuario: mocks.obtenerPerfil,
}));
vi.mock("@/modulos/usuarios/administradores/componentes/modificar-administrador/FormularioModificarAdministrador", () => ({ default: () => null }));

import PaginaModificarMiPerfilAdministrador from "./page";

const perfil = {
    id: 101,
    usuarioId: 7,
    nombreUsuario: "ana.admin",
    email: "ana@ejemplo.com",
    segundoFactorActivado: true,
    solicitoRestablecimiento: false,
};

describe("Página Modificar mi perfil del Administrador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requerirAdministrador.mockResolvedValue({ usuarioId: 7, rol: "ADMINISTRADOR" });
        mocks.obtenerPerfil.mockResolvedValue(perfil);
    });

    it("abre el formulario en modo Mi perfil con los datos de la sesión", async () => {
        const pagina = await PaginaModificarMiPerfilAdministrador();

        expect(mocks.obtenerPerfil).toHaveBeenCalledWith(7);
        expect(pagina.props.children.props).toMatchObject({ administrador: perfil, perfilPropio: true });
    });

    it("no deja entrar a quien no es Administrador", async () => {
        mocks.requerirAdministrador.mockRejectedValue(new Error("NEXT_REDIRECT"));

        await expect(PaginaModificarMiPerfilAdministrador()).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.obtenerPerfil).not.toHaveBeenCalled();
    });

    it("muestra la página de no encontrado si no hay perfil", async () => {
        mocks.obtenerPerfil.mockResolvedValue(null);

        await expect(PaginaModificarMiPerfilAdministrador()).rejects.toThrow("NEXT_NOT_FOUND");
    });
});