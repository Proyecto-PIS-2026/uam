import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PerfilPublicoOperador } from "../../../../modulos/usuarios/operadores/consultas-perfil-publico";
import Page from "./page";

// Creo dos funciones falsas de obtener perfil y el notFound
const mocks = vi.hoisted(() => ({
    obtenerPerfil: vi.fn(),
    refresh: vi.fn(),
    obtenerSesion: vi.fn(),
    obtenerOperadorActual: vi.fn(),
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
    notFound: vi.fn(() => {
        throw new Error("PERFIL_NO_ENCONTRADO");
    }),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: mocks.obtenerSesion,
}));

vi.mock("@/modulos/usuarios/operadores/operador-actual", () => ({
    obtenerOperadorActual: mocks.obtenerOperadorActual,
}));

// Reemplaza el import de la página por mi función falsa
vi.mock("../../../../modulos/usuarios/operadores/consultas-perfil-publico", () => ({
    obtenerPerfilPublicoOperador: mocks.obtenerPerfil,
}));

// Reemplaza el import de next/navigation por mi función falsa
vi.mock("next/navigation", () => ({
    notFound: mocks.notFound,
    redirect: mocks.redirect,
    useRouter: () => ({ refresh: mocks.refresh }),
}));

// Reemplaza Image de Next por un img común
vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({src, alt}: {src: string; alt: string}) => createElement("img", {src, alt}),
    };
});

// Datos de prueba
const perfil: PerfilPublicoOperador = {
    id: 13,
    nombreFantasia: "Frutas del Norte",
    fotoPerfil: null,
    whatsApp: "+59899100001",
    locales: [{numeroLocal: "18", nombreNave: "B"}],
    publicaciones: [{
        id: 101,
        foto: null,
        precio: "120",
        fecha: "2026-10-03T15:00:00.000Z",
        especie: "Tomate",
        variedad: "Perita",
        presentacion: "Cajón",
        categoria: "Extra",
        calibre: "A",
        pais: "URUGUAY",
    }],
};

describe("Página pública del operador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerSesion.mockResolvedValue(null);
    });

    it("redirige al operador a su mercado sin consultar un perfil ajeno", async () => {
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        mocks.obtenerOperadorActual.mockResolvedValue({ id: 24, usuarioId: 10, nombreFantasia: "Mi huerta" });
        await expect(Page({ params: Promise.resolve({ nombre: "Frutas del Norte" }), searchParams: Promise.resolve({})})).rejects.toThrow("NEXT_REDIRECT");

        expect(mocks.redirect).toHaveBeenCalledWith("/mi-mercado");
        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.obtenerPerfil).not.toHaveBeenCalled();
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    it("permite al operador consultar su propio perfil con el nombre decodificado", async () => {
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        mocks.obtenerOperadorActual.mockResolvedValue({ id: perfil.id, usuarioId: 10, nombreFantasia: perfil.nombreFantasia });
        mocks.obtenerPerfil.mockResolvedValue(perfil);

        render(await Page({ params: Promise.resolve({ nombre: "Frutas del Norte" }), searchParams: Promise.resolve({}) }));

        expect(mocks.redirect).not.toHaveBeenCalled();
        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.obtenerPerfil).toHaveBeenCalledWith("Frutas del Norte");
        expect(screen.getByRole("heading", { name: "Frutas del Norte" })).toBeInTheDocument();
        expect(screen.getByText("Tomate - Perita")).toBeInTheDocument();
    });

    it.each([null, "PRODUCTOR", "ADMINISTRADOR"] as const)("conserva el perfil público para la sesión %s", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue(rol ? { usuarioId: 20, rol, expiraEn: 2000000000 } : null);
        mocks.obtenerPerfil.mockResolvedValue(perfil);

        render(await Page({ params: Promise.resolve({ nombre: "Frutas del Norte" }), searchParams: Promise.resolve({}) }));

        expect(mocks.redirect).not.toHaveBeenCalled();
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
        expect(mocks.obtenerPerfil).toHaveBeenCalledWith("Frutas del Norte");
        expect(screen.getByRole("heading", { name: "Frutas del Norte" })).toBeInTheDocument();
        expect(screen.getByText("Tomate - Perita")).toBeInTheDocument();
    });

    it("consulta el operador indicado en la URL y muestra su perfil y catálogo", async () => {
        mocks.obtenerPerfil.mockResolvedValue(perfil);

        const contenido = await Page({params: Promise.resolve({nombre: "Frutas del Norte"}), searchParams: Promise.resolve({})});
        render(contenido);

        expect(mocks.obtenerPerfil).toHaveBeenCalledWith("Frutas del Norte");
        expect(mocks.notFound).not.toHaveBeenCalled();
        expect(screen.getByRole("main")).toBeInTheDocument();
        expect(screen.getByRole("heading", {name: "Frutas del Norte"})).toBeInTheDocument();
        expect(screen.getByRole("heading", {name: "Publicaciones"})).toBeInTheDocument();
        expect(screen.getByText("Tomate - Perita")).toBeInTheDocument();
    });

    it("llama a notFound cuando el operador no existe", async () => {
        mocks.obtenerPerfil.mockResolvedValue(null);

        await expect(Page({params: Promise.resolve({nombre: "Operador inexistente"}), searchParams: Promise.resolve({})})).rejects.toThrow("PERFIL_NO_ENCONTRADO");

        expect(mocks.obtenerPerfil).toHaveBeenCalledWith("Operador inexistente");
        expect(mocks.notFound).toHaveBeenCalledOnce();
    });

    it.each(["Jorge Ferias", "Frutas & Más", "Frutas 100%", "Frutas %20", "%", "%ZZ", "%C3"])("conserva el nombre ya decodificado por Next: %s", async (nombre) => {
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        mocks.obtenerOperadorActual.mockResolvedValue({ id: perfil.id, usuarioId: 10, nombreFantasia: nombre });
        mocks.obtenerPerfil.mockResolvedValue({ ...perfil, nombreFantasia: nombre });

        await Page({ params: Promise.resolve({ nombre }), searchParams: Promise.resolve({}) });

        expect(mocks.redirect).not.toHaveBeenCalled();
        expect(mocks.obtenerPerfil).toHaveBeenCalledExactlyOnceWith(nombre);
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    it.each(["", "   "])("llama a notFound cuando el nombre está vacío: %s", async (nombre) => {
        await expect(Page({params: Promise.resolve({nombre}), searchParams: Promise.resolve({})})).rejects.toThrow("PERFIL_NO_ENCONTRADO");
        expect(mocks.obtenerPerfil).not.toHaveBeenCalled();
        expect(mocks.notFound).toHaveBeenCalledOnce();
    });
});
