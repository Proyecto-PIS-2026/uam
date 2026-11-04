import { beforeEach, describe, expect, it, vi } from "vitest";
import { eliminarFotoEspecie, guardarFotoEspecie } from "./foto-especie";

const mocks = vi.hoisted(() => ({
    exigirAdministrador: vi.fn(),
    select: vi.fn(),
    where: vi.fn(),
    first: vi.fn(),
    update: vi.fn(),
    guardarImagen: vi.fn(),
    limpiarImagen: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    exigirAdministrador: mocks.exigirAdministrador,
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Especie: {
                    select: mocks.select,
                    where: mocks.where,
                },
            },
        },
    },
}));

vi.mock("./imagenes-especies", () => ({
    guardarImagenEspecie: mocks.guardarImagen,
}));

vi.mock("./limpiar-imagen-especie", () => ({
    limpiarImagenEspecieNoReferenciada: mocks.limpiarImagen,
}));

const fotoAnterior = "/api/imagenes/especies/1/anterior.webp";
const fotoNueva = "/api/imagenes/especies/1/nueva.webp";

function crearArchivo() {
    return new File(["imagen"], "foto.png", { type: "image/png" });
}

beforeEach(() => {
    vi.resetAllMocks();

    const consulta = {
        select: mocks.select,
        where: mocks.where,
        first: mocks.first,
        update: mocks.update,
    };

    mocks.select.mockReturnValue(consulta);
    mocks.where.mockReturnValue(consulta);
    mocks.first.mockResolvedValue({ fotoEspecie: fotoAnterior });
    mocks.update.mockResolvedValue({ id: 1 });
    mocks.guardarImagen.mockResolvedValue(fotoNueva);
    mocks.limpiarImagen.mockResolvedValue(undefined);
    mocks.exigirAdministrador.mockResolvedValue(undefined);
});

describe("guardarFotoEspecie", () => {
    it("rechaza la operación si falla la autorización", async () => {
        mocks.exigirAdministrador.mockRejectedValue(new Error("No autorizado"));

        await expect(guardarFotoEspecie(1, crearArchivo())).rejects.toThrow("No autorizado");

        expect(mocks.first).not.toHaveBeenCalled();
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.limpiarImagen).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rechaza el identificador %s", async (id) => {
        await expect(guardarFotoEspecie(id, crearArchivo())).rejects.toThrow("La especie no es válida.");
        expect(mocks.first).not.toHaveBeenCalled();
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it("rechaza una especie inexistente", async () => {
        mocks.first.mockResolvedValue(null);

        await expect(guardarFotoEspecie(1, crearArchivo())).rejects.toThrow("La especie no existe.");

        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.limpiarImagen).not.toHaveBeenCalled();
    });

    it("guarda la imagen y actualiza la referencia antes de limpiar la anterior", async () => {
        const archivo = crearArchivo();

        mocks.limpiarImagen.mockImplementation(async () => {
            expect(mocks.update).toHaveBeenCalledWith({ fotoEspecie: fotoNueva });
        });

        await guardarFotoEspecie(1, archivo);

        expect(mocks.exigirAdministrador).toHaveBeenCalledOnce();
        expect(mocks.where).toHaveBeenNthCalledWith(1, { id: 1 });
        expect(mocks.guardarImagen).toHaveBeenCalledExactlyOnceWith(1, archivo);
        expect(mocks.where).toHaveBeenNthCalledWith(2, { id: 1, fotoEspecie: fotoAnterior });
        expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ fotoEspecie: fotoNueva });
        expect(mocks.limpiarImagen).toHaveBeenCalledExactlyOnceWith(fotoAnterior, 1);
    });

    it("permite agregar una foto cuando la especie no tenía imagen", async () => {
        mocks.first.mockResolvedValue({ fotoEspecie: null });

        await guardarFotoEspecie(1, crearArchivo());

        expect(mocks.where).toHaveBeenNthCalledWith(2, { id: 1, fotoEspecie: null });
        expect(mocks.update).toHaveBeenCalledWith({ fotoEspecie: fotoNueva });
        expect(mocks.limpiarImagen).not.toHaveBeenCalled();
    });

    it("propaga el error de lectura sin guardar ninguna imagen", async () => {
        mocks.first.mockRejectedValue(new Error("Error de consulta"));

        await expect(guardarFotoEspecie(1, crearArchivo())).rejects.toThrow("Error de consulta");

        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.limpiarImagen).not.toHaveBeenCalled();
    });

    it("propaga un error de almacenamiento sin modificar la especie", async () => {
        mocks.guardarImagen.mockRejectedValue(new Error("Imagen inválida"));

        await expect(guardarFotoEspecie(1, crearArchivo())).rejects.toThrow("Imagen inválida");

        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.limpiarImagen).not.toHaveBeenCalled();
    });

    it("intenta limpiar la imagen nueva si falla la actualización", async () => {
        mocks.update.mockRejectedValue(new Error("Error al actualizar"));

        await expect(guardarFotoEspecie(1, crearArchivo())).rejects.toThrow("Error al actualizar");

        expect(mocks.limpiarImagen).toHaveBeenCalledExactlyOnceWith(fotoNueva, 1);
        expect(mocks.limpiarImagen).not.toHaveBeenCalledWith(fotoAnterior, 1);
    });

    it("detecta un cambio concurrente y limpia únicamente la imagen nueva", async () => {
        mocks.update.mockResolvedValue(null);

        await expect(guardarFotoEspecie(1, crearArchivo())).rejects.toThrow("La foto cambió mientras la editabas. Actualizá e intentá nuevamente.");

        expect(mocks.where).toHaveBeenNthCalledWith(2, { id: 1, fotoEspecie: fotoAnterior });
        expect(mocks.limpiarImagen).toHaveBeenCalledExactlyOnceWith(fotoNueva, 1);
        expect(mocks.limpiarImagen).not.toHaveBeenCalledWith(fotoAnterior, 1);
    });
});

describe("eliminarFotoEspecie", () => {
    it("rechaza la operación si falla la autorización", async () => {
        mocks.exigirAdministrador.mockRejectedValue(new Error("No autorizado"));

        await expect(eliminarFotoEspecie(1)).rejects.toThrow("No autorizado");

        expect(mocks.first).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.limpiarImagen).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rechaza el identificador %s", async (id) => {
        await expect(eliminarFotoEspecie(id)).rejects.toThrow("La especie no es válida.");
        expect(mocks.first).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.limpiarImagen).not.toHaveBeenCalled();
    });

    it("rechaza una especie inexistente", async () => {
        mocks.first.mockResolvedValue(null);

        await expect(eliminarFotoEspecie(1)).rejects.toThrow("La especie no existe.");

        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.limpiarImagen).not.toHaveBeenCalled();
    });

    it("no modifica nada si la especie ya estaba sin foto", async () => {
        mocks.first.mockResolvedValue({ fotoEspecie: null });

        await expect(eliminarFotoEspecie(1)).resolves.toBeUndefined();

        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.limpiarImagen).not.toHaveBeenCalled();
    });

    it("quita la referencia antes de limpiar la imagen anterior", async () => {
        mocks.limpiarImagen.mockImplementation(async () => {
            expect(mocks.update).toHaveBeenCalledWith({ fotoEspecie: null });
        });

        await eliminarFotoEspecie(1);

        expect(mocks.exigirAdministrador).toHaveBeenCalledOnce();
        expect(mocks.where).toHaveBeenNthCalledWith(1, { id: 1 });
        expect(mocks.where).toHaveBeenNthCalledWith(2, { id: 1, fotoEspecie: fotoAnterior });
        expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ fotoEspecie: null });
        expect(mocks.limpiarImagen).toHaveBeenCalledExactlyOnceWith(fotoAnterior, 1);
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
    });

    it("conserva la imagen si falla la consulta", async () => {
        mocks.first.mockRejectedValue(new Error("Error de consulta"));

        await expect(eliminarFotoEspecie(1)).rejects.toThrow("Error de consulta");

        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.limpiarImagen).not.toHaveBeenCalled();
    });

    it("conserva la imagen si falla la actualización", async () => {
        mocks.update.mockRejectedValue(new Error("Error al actualizar"));

        await expect(eliminarFotoEspecie(1)).rejects.toThrow("Error al actualizar");

        expect(mocks.limpiarImagen).not.toHaveBeenCalled();
    });

    it("evita limpiar una foto modificada concurrentemente", async () => {
        mocks.update.mockResolvedValue(null);

        await expect(eliminarFotoEspecie(1)).rejects.toThrow("La foto cambió mientras la editabas. Actualizá e intentá nuevamente.");

        expect(mocks.where).toHaveBeenNthCalledWith(2, { id: 1, fotoEspecie: fotoAnterior });
        expect(mocks.limpiarImagen).not.toHaveBeenCalled();
    });
});