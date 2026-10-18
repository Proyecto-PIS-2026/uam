// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(), buscarProductor: vi.fn(), where: vi.fn(),
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
    notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.obtenerSesion }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { orm: { public: { Productor: { where: mocks.where } } } } }));
vi.mock("@/modulos/publicaciones/productores/AltaPublicacionProductor", () => ({ default: vi.fn() }));

import Page from "./page";
import AltaPublicacionProductor from "@/modulos/publicaciones/productores/AltaPublicacionProductor";

describe("/alta-publicacion-productor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 });
        mocks.where.mockReturnValue({ select: () => ({ first: mocks.buscarProductor }) });
        mocks.buscarProductor.mockResolvedValue({ id: 4, usuarioId: 10 });
    });

    it("muestra el alta con el Productor del usuario autenticado", async () => {
        const vista = await Page();
        expect(vista.type).toBe(AltaPublicacionProductor);
        expect(vista.props).toEqual({ productorId: 4 });
        expect(mocks.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 10 });
    });

    it.each([
        { rol: null, ruta: "/iniciar-sesion" }, { rol: "OPERADOR", ruta: "/mi-mercado" }, { rol: "ADMINISTRADOR", ruta: "/inicio" },
    ])("redirige $rol a $ruta sin consultar perfiles", async ({ rol, ruta }) => {
        mocks.obtenerSesion.mockResolvedValue(rol ? { usuarioId: 10, rol, expiraEn: 2000000000 } : null);
        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith(ruta);
        expect(mocks.where).not.toHaveBeenCalled();
    });

    it("devuelve no encontrado si el Productor no existe", async () => {
        mocks.buscarProductor.mockResolvedValue(null);
        await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mocks.notFound).toHaveBeenCalledOnce();
    });

    it("no permite abrir el alta de un perfil ajeno", async () => {
        mocks.buscarProductor.mockResolvedValue({ id: 4, usuarioId: 99 });
        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/inicio");
    });
});
