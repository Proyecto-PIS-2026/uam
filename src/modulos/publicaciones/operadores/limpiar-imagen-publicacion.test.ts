import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { limpiarImagenPublicacionNoReferenciada } from "./limpiar-imagen-publicacion";

const mocks = vi.hoisted(() => ({ buscar: vi.fn(), eliminar: vi.fn() }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: { Publicacion: { select: () => ({ where: () => ({ first: mocks.buscar }) }) } } } },
}));
vi.mock("./imagenes-publicacion", () => ({ eliminarImagenPublicacionGestionada: mocks.eliminar }));

const URL = "/api/publicaciones/imagenes/42/12345678-1234-4234-8234-123456789abc.webp";

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("limpieza tras una transacción fallida", () => {
    it.each([null, { foto: "/anterior.jpg" }])("elimina cuando confirma que la foto no está referenciada", async (publicacion) => {
        mocks.buscar.mockResolvedValue(publicacion);
        await limpiarImagenPublicacionNoReferenciada(URL, 42);
        expect(mocks.eliminar).toHaveBeenCalledWith(URL, 42);
    });

    it("conserva el archivo si el commit se confirmó aunque su respuesta falló", async () => {
        mocks.buscar.mockResolvedValue({ foto: URL });
        await limpiarImagenPublicacionNoReferenciada(URL, 42);
        expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it("conserva el archivo si la base no permite comprobar el estado", async () => {
        mocks.buscar.mockRejectedValue(new Error("Conexión interrumpida"));
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);
        await expect(limpiarImagenPublicacionNoReferenciada(URL, 42)).resolves.toBeUndefined();
        expect(mocks.eliminar).not.toHaveBeenCalled();
        expect(registrar).toHaveBeenCalledOnce();
    });
});
