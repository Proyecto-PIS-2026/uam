import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(),
    obtenerPerfil: vi.fn(),
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT") }),
    notFound: vi.fn(() => { throw new Error("NOT_FOUND") }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.obtenerSesion }));
vi.mock("@/modulos/usuarios/productores/acciones/consultas-perfil-por-operador", () => ({ obtenerPerfilProductorPorOperador: mocks.obtenerPerfil }));
vi.mock("@/modulos/usuarios/productores/componentes/perfil-operador-productor/perfil-productor/PerfilProductor", () => ({ default: () => null }));
vi.mock("@/modulos/usuarios/productores/componentes/perfil-operador-productor/catalogo-productor/CatalogoProductor", () => ({ default: () => null }));

import Page from "./page";

describe("/productores/[nombre]", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        mocks.obtenerPerfil.mockResolvedValue({ id: 4, nombreFantasia: "Quinta", publicaciones: [], whatsApp: "" });
    });

    it.each(["Quinta del Sur", "Frutas & Más", "Frutas 100%", "Frutas %20", "%", "%ZZ", "%C3"])("consulta el nombre original sin decodificar porcentajes literales dos veces: %s", async (nombre) => {
        await Page({ params: Promise.resolve({ nombre: encodeURIComponent(nombre) }), searchParams: Promise.resolve({}) });

        expect(mocks.obtenerSesion).toHaveBeenCalledOnce();
        expect(mocks.redirect).not.toHaveBeenCalled();
        expect(mocks.obtenerPerfil).toHaveBeenCalledExactlyOnceWith(nombre);
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    it.each(["", "%20%20", "%ZZ"])("rechaza nombres vacíos o parámetros mal codificados: %s", async (nombre) => {
        await expect(Page({ params: Promise.resolve({ nombre }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
        expect(mocks.obtenerPerfil).not.toHaveBeenCalled();
    });

    it.each([
        { rol: null, destino: "/sesion-finalizada" },
        { rol: "ADMINISTRADOR", destino: "/inicio" },
        { rol: "PRODUCTOR", destino: "/mi-mercado/productor" },
    ] as const)("rechaza el acceso de $rol antes de consultar datos o esperar parámetros", async ({ rol, destino }) => {
        mocks.obtenerSesion.mockResolvedValue(rol ? { usuarioId: 10, rol, expiraEn: 2000000000 } : null);
        const esperarNombre = vi.fn((resolver: (valor: { nombre: string }) => void) => resolver({ nombre: "Quinta" }));
        const esperarOrigen = vi.fn((resolver: (valor: { origen: string }) => void) => resolver({ origen: "publicaciones" }));
        const params = { then: esperarNombre } as unknown as Promise<{ nombre: string }>;
        const searchParams = { then: esperarOrigen } as unknown as Promise<{ origen: string }>;

        await expect(Page({ params, searchParams })).rejects.toThrow("NEXT_REDIRECT");

        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith(destino);
        expect(mocks.obtenerSesion).toHaveBeenCalledOnce();
        expect(esperarNombre).not.toHaveBeenCalled();
        expect(esperarOrigen).not.toHaveBeenCalled();
        expect(mocks.obtenerPerfil).not.toHaveBeenCalled();
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    it("propaga la falla de sesión sin consultar el perfil", async () => {
        const error = new Error("Sesión no disponible");
        mocks.obtenerSesion.mockRejectedValue(error);
        await expect(Page({ params: Promise.resolve({ nombre: "Quinta" }), searchParams: Promise.resolve({}) })).rejects.toBe(error);
        expect(mocks.obtenerPerfil).not.toHaveBeenCalled();
        expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("mantiene el 404 cuando el productor no existe", async () => {
        mocks.obtenerPerfil.mockResolvedValue(null);
        await expect(Page({ params: Promise.resolve({ nombre: "Inexistente" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
    });
});
