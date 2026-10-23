import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requerirConsulta: vi.fn(),
    obtenerPerfil: vi.fn(),
    notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ requerirConsultaProductores: mocks.requerirConsulta }));
vi.mock("@/modulos/usuarios/productores/acciones/consultas-perfil-por-operador", () => ({ obtenerPerfilProductorPorOperador: mocks.obtenerPerfil }));
vi.mock("@/modulos/usuarios/productores/componentes/perfil-operador-productor/perfil-productor/PerfilProductor", () => ({ default: () => null }));
vi.mock("@/modulos/usuarios/productores/componentes/perfil-operador-productor/catalogo-productor/CatalogoProductor", () => ({ default: () => null }));

import Page from "./page";

describe("/productores/[nombre]", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.obtenerPerfil.mockResolvedValue({ id: 4, nombreFantasia: "Quinta", publicaciones: [], whatsApp: "" });
    });

    it.each(["Quinta del Sur", "Frutas & Más", "Frutas 100%", "Frutas %20", "%", "%ZZ", "%C3"])("consulta el nombre original sin decodificar porcentajes literales dos veces: %s", async (nombre) => {
        await Page({ params: Promise.resolve({ nombre: encodeURIComponent(nombre) }), searchParams: Promise.resolve({}) });

        expect(mocks.requerirConsulta).toHaveBeenCalledOnce();
        expect(mocks.obtenerPerfil).toHaveBeenCalledExactlyOnceWith(nombre);
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    it.each(["", "%20%20", "%ZZ"])("rechaza nombres vacíos o parámetros mal codificados: %s", async (nombre) => {
        await expect(Page({ params: Promise.resolve({ nombre }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
        expect(mocks.obtenerPerfil).not.toHaveBeenCalled();
    });

    it("conserva la autorización antes de consultar el perfil", async () => {
        mocks.requerirConsulta.mockRejectedValue(new Error("SIN_PERMISO"));
        await expect(Page({ params: Promise.resolve({ nombre: "Quinta" }), searchParams: Promise.resolve({}) })).rejects.toThrow("SIN_PERMISO");
        expect(mocks.obtenerPerfil).not.toHaveBeenCalled();
    });

    it("mantiene el 404 cuando el productor no existe", async () => {
        mocks.obtenerPerfil.mockResolvedValue(null);
        await expect(Page({ params: Promise.resolve({ nombre: "Inexistente" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
    });
});
