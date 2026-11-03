import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { limpiarImagenEspecieNoReferenciada } from "./limpiar-imagen-especie";

const mocks = vi.hoisted(() => ({
    select: vi.fn(),
    where: vi.fn(),
    first: vi.fn(),
    eliminarImagen: vi.fn(),
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Especie: {
                    select: mocks.select,
                },
            },
        },
    },
}));

vi.mock("./imagenes-especies", () => ({
    eliminarImagenEspecieGestionada: mocks.eliminarImagen,
}));

const url = "/api/imagenes/especies/1/12345678-1234-4234-8234-123456789abc.webp";

beforeEach(() => {
    vi.resetAllMocks();

    const consulta = { where: mocks.where, first: mocks.first };
    mocks.select.mockReturnValue(consulta);
    mocks.where.mockReturnValue(consulta);
    mocks.eliminarImagen.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("limpiarImagenEspecieNoReferenciada", () => {
    it("consulta la foto de la especie indicada", async () => {
        mocks.first.mockResolvedValue({ fotoEspecie: url });

        await limpiarImagenEspecieNoReferenciada(url, 1);

        expect(mocks.select).toHaveBeenCalledExactlyOnceWith("fotoEspecie");
        expect(mocks.where).toHaveBeenCalledExactlyOnceWith({ id: 1 });
        expect(mocks.first).toHaveBeenCalledOnce();
    });

    it("conserva la imagen cuando sigue siendo la foto actual", async () => {
        mocks.first.mockResolvedValue({ fotoEspecie: url });

        await limpiarImagenEspecieNoReferenciada(url, 1);

        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
    });

    it("elimina la imagen cuando la especie tiene otra foto", async () => {
        mocks.first.mockResolvedValue({ fotoEspecie: "/otra-foto.webp" });

        await limpiarImagenEspecieNoReferenciada(url, 1);

        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(url, 1);
    });

    it("elimina la imagen cuando la especie ya no tiene foto", async () => {
        mocks.first.mockResolvedValue({ fotoEspecie: null });

        await limpiarImagenEspecieNoReferenciada(url, 1);

        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(url, 1);
    });

    it("elimina la imagen cuando la especie ya no existe", async () => {
        mocks.first.mockResolvedValue(null);

        await limpiarImagenEspecieNoReferenciada(url, 1);

        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(url, 1);
    });

    it("conserva la imagen si no puede comprobar el estado en la base", async () => {
        const error = new Error("Conexión interrumpida");
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.first.mockRejectedValue(error);

        await expect(limpiarImagenEspecieNoReferenciada(url, 1)).resolves.toBeUndefined();

        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
        expect(registrar).toHaveBeenCalledExactlyOnceWith("No se pudo confirmar la limpieza de una imagen de especie.", error);
    });

    it("registra el error de eliminación sin propagarlo", async () => {
        const error = new Error("No se pudo eliminar la imagen");
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.first.mockResolvedValue({ fotoEspecie: null });
        mocks.eliminarImagen.mockRejectedValue(error);

        await expect(limpiarImagenEspecieNoReferenciada(url, 1)).resolves.toBeUndefined();

        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(url, 1);
        expect(registrar).toHaveBeenCalledExactlyOnceWith("No se pudo confirmar la limpieza de una imagen de especie.", error);
    });
});