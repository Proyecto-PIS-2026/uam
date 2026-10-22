// @vitest-environment node

import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mkdir: vi.fn(), writeFile: vi.fn(), unlink: vi.fn() }));
vi.mock("node:fs/promises", () => mocks);
vi.mock("node:crypto", () => ({ randomUUID: () => "12345678-1234-4234-8234-123456789abc" }));

import { eliminarImagenProductor, ErrorImagenProductor, guardarImagenProductor } from "./imagenes-productor";

const nombre = "12345678-1234-4234-8234-123456789abc";
const directorio = join(process.cwd(), "storage", "publicaciones", "42");

describe("imágenes de publicaciones de Productor", () => {
    beforeEach(() => vi.resetAllMocks());
    afterEach(() => vi.restoreAllMocks());

    it.each([
        { extension: "png", contenido: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) },
        { extension: "jpg", contenido: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]) },
        { extension: "webp", contenido: Buffer.from("RIFF0000WEBP") },
    ])("guarda $extension según el contenido del archivo", async ({ extension, contenido }) => {
        const url = await guardarImagenProductor(42, `data:image/png;base64,${contenido.toString("base64")}`);
        expect(url).toBe(`/api/publicaciones/imagenes/42/${nombre}.${extension}`);
        expect(mocks.mkdir).toHaveBeenCalledExactlyOnceWith(directorio, { recursive: true });
        expect(mocks.writeFile).toHaveBeenCalledExactlyOnceWith(join(directorio, `${nombre}.${extension}`), contenido, { flag: "wx" });
    });

    it.each([Buffer.alloc(0), Buffer.alloc(10 * 1024 * 1024 + 1)])("rechaza tamaño inválido sin escribir archivos", async (contenido) => {
        await expect(guardarImagenProductor(42, `data:image/png;base64,${contenido.toString("base64")}`)).rejects.toThrow("La imagen debe pesar entre 1 byte y 10 MB.");
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it.each([Buffer.from("GIF89a"), Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0]), Buffer.from("RIFF0000OTRO")])("rechaza contenido que no es PNG, JPEG ni WebP", async (contenido) => {
        await expect(guardarImagenProductor(42, `data:image/png;base64,${contenido.toString("base64")}`)).rejects.toBeInstanceOf(ErrorImagenProductor);
        expect(mocks.mkdir).not.toHaveBeenCalled();
    });

    it("propaga el error de escritura", async () => {
        const error = new Error("Disco lleno");
        mocks.writeFile.mockRejectedValue(error);
        await expect(guardarImagenProductor(42, "data:image/webp;base64,UklGRjAwMDBXRUJQ")).rejects.toBe(error);
    });

    it("elimina solamente el archivo gestionado indicado por la URL", async () => {
        await eliminarImagenProductor(`/api/publicaciones/imagenes/42/${nombre}.png`);
        expect(mocks.unlink).toHaveBeenCalledExactlyOnceWith(join(directorio, `${nombre}.png`));
    });

    it.each([null, "", `/api/publicaciones/imagenes/42/../${nombre}.png`, `/api/publicaciones/imagenes/0/${nombre}.png`, "https://otro.test/foto.png"])("ignora una URL no gestionada: %j", async (url) => {
        await eliminarImagenProductor(url);
        expect(mocks.unlink).not.toHaveBeenCalled();
    });

    it("tolera que el archivo ya no exista", async () => {
        mocks.unlink.mockRejectedValue(Object.assign(new Error("No existe"), { code: "ENOENT" }));
        await expect(eliminarImagenProductor(`/api/publicaciones/imagenes/42/${nombre}.png`)).resolves.toBeUndefined();
    });

    it("propaga errores de eliminación distintos de archivo inexistente", async () => {
        const error = Object.assign(new Error("Sin permisos"), { code: "EACCES" });
        mocks.unlink.mockRejectedValue(error);
        await expect(eliminarImagenProductor(`/api/publicaciones/imagenes/42/${nombre}.png`)).rejects.toBe(error);
    });
});
