import { beforeEach, describe, expect, it, vi } from "vitest";
import { eliminarImagenEspecieGestionada, ErrorImagenEspecie, guardarImagenEspecie } from "./imagenes-especies";
import { ErrorImagen } from "@/infraestructura/imagenes/almacenamiento-imagenes";

const mocks = vi.hoisted(() => ({
    guardar: vi.fn(),
    eliminar: vi.fn(),
}));

vi.mock("@/infraestructura/imagenes/imagenes", () => ({
    imagenes: {
        guardar: mocks.guardar,
        eliminar: mocks.eliminar,
    },
}));

const url = "/api/imagenes/especies/1/12345678-1234-4234-8234-123456789abc.webp";

beforeEach(() => {
    vi.resetAllMocks();
    mocks.guardar.mockResolvedValue(url);
    mocks.eliminar.mockResolvedValue(undefined);
});

describe("guardarImagenEspecie", () => {
    it("guarda el archivo en la categoría especies y devuelve su URL", async () => {
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });

        const resultado = await guardarImagenEspecie(1, archivo);

        expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith("especies", 1, archivo);
        expect(resultado).toBe(url);
    });

    it("propaga los errores de validación del servicio", async () => {
        const archivo = new File(["imagen"], "foto.gif", { type: "image/gif" });
        const error = new ErrorImagenEspecie("La imagen debe ser JPEG, PNG o WebP.");
        mocks.guardar.mockRejectedValue(error);

        await expect(guardarImagenEspecie(1, archivo)).rejects.toBe(error);
    });

    it("propaga los errores de almacenamiento", async () => {
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        const error = new Error("No se pudo almacenar la imagen");
        mocks.guardar.mockRejectedValue(error);

        await expect(guardarImagenEspecie(1, archivo)).rejects.toBe(error);
    });
});

describe("eliminarImagenEspecieGestionada", () => {
    it("solicita eliminar la imagen de la especie indicada", async () => {
        await eliminarImagenEspecieGestionada(url, 1);

        expect(mocks.eliminar).toHaveBeenCalledExactlyOnceWith(url, "especies", 1);
    });

    it("delega al servicio una URL nula", async () => {
        await expect(eliminarImagenEspecieGestionada(null, 1)).resolves.toBeUndefined();

        expect(mocks.eliminar).toHaveBeenCalledExactlyOnceWith(null, "especies", 1);
    });

    it("propaga los errores de eliminación", async () => {
        const error = new Error("No se pudo eliminar la imagen");
        mocks.eliminar.mockRejectedValue(error);

        await expect(eliminarImagenEspecieGestionada(url, 1)).rejects.toBe(error);
    });
});

describe("ErrorImagenEspecie", () => {
    it("reexporta el error de imágenes compartido", () => {
        expect(ErrorImagenEspecie).toBe(ErrorImagen);
    });
});