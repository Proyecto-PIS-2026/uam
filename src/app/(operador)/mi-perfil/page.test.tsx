import { describe, expect, it, vi } from "vitest";
import Page from "./page";

const mocks = vi.hoisted(() => ({
    requerirOperador: vi.fn(),
    obtenerPerfil: vi.fn(),
    perfil: vi.fn((props: unknown) => props),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ requerirOperador: mocks.requerirOperador }));
vi.mock("@/modulos/usuarios/operadores/consultasPerfilPropio", () => ({ obtenerPerfilPropioOperador: mocks.obtenerPerfil }));
vi.mock("@/modulos/usuarios/operadores/componentes/perfil-propio-operador/PerfilPropioOperador", () => ({ default: mocks.perfil }));

describe("Página de mi perfil", () => {
    it("exige operador, obtiene su perfil y lo renderiza", async () => {
        const perfil = { id: 7, nombre: "Frutas del Norte" };
        mocks.obtenerPerfil.mockResolvedValue(perfil);
        const resultado = await Page();
        expect(mocks.requerirOperador).toHaveBeenCalledOnce();
        expect(mocks.obtenerPerfil).toHaveBeenCalledOnce();
        expect(resultado.props).toEqual({ perfil });
    });
});
