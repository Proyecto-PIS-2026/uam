import { beforeEach, describe, expect, it, vi } from "vitest";
import { guardarEdicionPublicacion } from "./actions";

const mocks = vi.hoisted(() => ({
    primero: vi.fn(),
    modificar: vi.fn(),
    select: vi.fn(),
    include: vi.fn(),
    where: vi.fn(),
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: { PublicacionOperador: {
        select: mocks.select,
        include: mocks.include,
        where: mocks.where,
        first: mocks.primero,
    } } } },
}));
vi.mock("@/modulos/publicaciones/operadores/modificar-publicacion", () => ({
    modificarPublicacionOperador: mocks.modificar,
}));

describe("guardarEdicionPublicacion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("NODE_ENV", "development");
        mocks.select.mockReturnThis();
        mocks.include.mockReturnThis();
        mocks.where.mockReturnThis();
        mocks.primero.mockResolvedValue({ id: 8, operador: { usuarioId: 22 } });
        mocks.modificar.mockResolvedValue({ publicacionOperadorId: 8, publicacionId: 41 });
    });

    it("resuelve el operador y delega el guardado", async () => {
        const cambios = {
            precio: "25",
            foto: null,
            categoriaId: 1,
            calibreId: 2,
            presentacionId: 3,
            disponible: false,
        };

        await expect(guardarEdicionPublicacion(8, cambios)).resolves.toEqual({ publicacionOperadorId: 8, publicacionId: 41 });
        expect(mocks.where).toHaveBeenCalledWith({ id: 8 });
        expect(mocks.modificar).toHaveBeenCalledWith(22, 8, cambios);
    });

    it("falla si la publicación no existe", async () => {
        mocks.primero.mockResolvedValue(null);

        await expect(guardarEdicionPublicacion(404, {
            precio: null,
            foto: null,
            categoriaId: 1,
            calibreId: 2,
            presentacionId: 3,
            disponible: true,
        })).rejects.toThrow("No se encontró la publicación del operador.");
        expect(mocks.modificar).not.toHaveBeenCalled();
    });

    it("bloquea la edición fuera del entorno de desarrollo", async () => {
        vi.stubEnv("NODE_ENV", "production");

        await expect(guardarEdicionPublicacion(8, {
            precio: null,
            foto: null,
            categoriaId: 1,
            calibreId: 2,
            presentacionId: 3,
            disponible: true,
        })).rejects.toThrow("La edición requiere integrar la autenticación del operador.");
        expect(mocks.primero).not.toHaveBeenCalled();
    });
});
