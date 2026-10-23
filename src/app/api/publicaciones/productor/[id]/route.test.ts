import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(),
    baja: vi.fn(),
    revalidatePath: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.obtenerSesion }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/modulos/publicaciones/productores/bajaPublicacionProductorAutorizada", async () => {
    class ErrorBajaPublicacionProductor extends Error {
        readonly status = 404;
    }
    return { bajaPublicacionProductorAutorizada: mocks.baja, ErrorBajaPublicacionProductor };
});

import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { ErrorBajaPublicacionProductor } from "@/modulos/publicaciones/productores/bajaPublicacionProductorAutorizada";
import { DELETE } from "./route";

const llamar = (id: string) => DELETE(new Request("http://localhost/api"), { params: Promise.resolve({ id }) });
const sesion = { rol: "PRODUCTOR", usuarioId: 10 };

describe("DELETE /api/publicaciones/productor/[id]", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.obtenerSesion.mockResolvedValue(sesion);
        mocks.baja.mockResolvedValue({ productorId: 3 });
    });

    it("elimina la publicación y revalida las vistas", async () => {
        const respuesta = await llamar("40");

        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({ mensaje: "Publicación eliminada correctamente." });
        expect(mocks.baja).toHaveBeenCalledExactlyOnceWith(sesion, 40);
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/gestion-productores/3");
    });

    it("responde 401 sin sesión", async () => {
        mocks.obtenerSesion.mockResolvedValue(null);

        const respuesta = await llamar("40");

        expect(respuesta.status).toBe(401);
        expect(mocks.baja).not.toHaveBeenCalled();
    });

    it.each(["0", "-1", "abc", "1.5", "2147483648"])("responde 400 si el id %s no es válido", async (id) => {
        const respuesta = await llamar(id);

        expect(respuesta.status).toBe(400);
        expect(mocks.baja).not.toHaveBeenCalled();
    });

    it("responde 403 si no tiene permiso", async () => {
        mocks.baja.mockRejectedValue(new ErrorAutorizacion(403, "No tenés permiso para eliminar esta publicación."));

        const respuesta = await llamar("40");

        expect(respuesta.status).toBe(403);
        expect((await respuesta.json()).errores[0]).toBe("No tenés permiso para eliminar esta publicación.");
    });

    it("responde 404 si la publicación no existe", async () => {
        mocks.baja.mockRejectedValue(new ErrorBajaPublicacionProductor("La publicación no existe o ya fue eliminada."));

        const respuesta = await llamar("40");

        expect(respuesta.status).toBe(404);
    });

    it("responde 500 ante un error inesperado", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.baja.mockRejectedValue(new Error("falló"));

        const respuesta = await llamar("40");

        expect(respuesta.status).toBe(500);
    });

    it("no falla si la revalidación lanza un error", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.revalidatePath.mockImplementation(() => { throw new Error("sin caché"); });

        const respuesta = await llamar("40");

        expect(respuesta.status).toBe(200);
    });
});