// @vitest-environment node

import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mkdir: vi.fn(), writeFile: vi.fn(), unlink: vi.fn(), readFile: vi.fn() }));
vi.mock("node:fs/promises", () => mocks);
vi.mock("node:crypto", () => ({ randomUUID: () => "12345678-1234-4234-8234-123456789abc" }));

import { eliminarImagenProductor, ErrorImagenProductor, guardarImagenProductor } from "./imagenes-productor";

const nombre = "12345678-1234-4234-8234-123456789abc";
const directorio = join(process.cwd(), "storage", "publicaciones", "42");

async function imagen(formato: "png" | "jpeg" | "webp" = "png", width = 20, height = 10) {
    const contenido = await sharp({ create: { width, height, channels: 3, background: "#229944" } }).toFormat(formato).toBuffer();
    return `data:image/${formato};base64,${contenido.toString("base64")}`;
}

describe("imágenes de publicaciones de Productor", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.mkdir.mockResolvedValue(undefined);
        mocks.writeFile.mockResolvedValue(undefined);
        mocks.unlink.mockResolvedValue(undefined);
    });
    afterEach(() => vi.restoreAllMocks());

    it.each(["png", "jpeg", "webp"] as const)("normaliza %s a WebP con el almacenamiento común", async (formato) => {
        const url = await guardarImagenProductor(42, await imagen(formato));
        expect(url).toBe(`/api/publicaciones/imagenes/42/${nombre}.webp`);
        expect(mocks.mkdir).toHaveBeenCalledExactlyOnceWith(directorio, { recursive: true });
        expect(mocks.writeFile).toHaveBeenCalledExactlyOnceWith(join(directorio, `${nombre}.webp`), expect.any(Buffer), { flag: "wx", mode: 0o600 });
        expect((await sharp(mocks.writeFile.mock.calls[0][1]).metadata()).format).toBe("webp");
    });

    it("reduce las fotografías grandes del Productor a 1600 píxeles", async () => {
        await guardarImagenProductor(42, await imagen("jpeg", 2000, 1000));
        const metadata = await sharp(mocks.writeFile.mock.calls[0][1]).metadata();
        expect(metadata.width).toBe(1600);
        expect(metadata.height).toBe(800);
    });

    it.each([Buffer.alloc(0), Buffer.alloc(10 * 1024 * 1024 + 1)])("rechaza tamaño inválido sin escribir archivos", async (contenido) => {
        await expect(guardarImagenProductor(42, `data:image/png;base64,${contenido.toString("base64")}`)).rejects.toBeInstanceOf(ErrorImagenProductor);
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it.each([Buffer.from("GIF89a"), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0]), Buffer.from("RIFF0000WEBP")])("rechaza firmas de imagen incompletas o contenido inválido", async (contenido) => {
        await expect(guardarImagenProductor(42, `data:image/png;base64,${contenido.toString("base64")}`)).rejects.toBeInstanceOf(ErrorImagenProductor);
        expect(mocks.mkdir).not.toHaveBeenCalled();
    });

    it("propaga el error de escritura", async () => {
        const error = new Error("Disco lleno");
        mocks.writeFile.mockRejectedValue(error);
        await expect(guardarImagenProductor(42, await imagen())).rejects.toBe(error);
        expect(mocks.unlink).toHaveBeenCalledExactlyOnceWith(join(directorio, `${nombre}.webp`));
    });

    it.each(["data:image/png;base64,A", "data:image/png;base64,====", "data:image/gif;base64,YWJj", "https://otro.test/foto.png"])("rechaza una codificación no admitida: %s", async (fotografia) => {
        await expect(guardarImagenProductor(42, fotografia)).rejects.toBeInstanceOf(ErrorImagenProductor);
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rechaza el identificador %s antes de escribir", async (id) => {
        await expect(guardarImagenProductor(id, await imagen())).rejects.toBeInstanceOf(ErrorImagenProductor);
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it("elimina solamente el archivo gestionado indicado por la URL", async () => {
        await eliminarImagenProductor(`/api/publicaciones/imagenes/42/${nombre}.png`, 42);
        expect(mocks.unlink).toHaveBeenCalledExactlyOnceWith(join(directorio, `${nombre}.png`));
    });

    it.each([null, "", `/api/publicaciones/imagenes/42/../${nombre}.png`, `/api/publicaciones/imagenes/0/${nombre}.png`, `/api/publicaciones/imagenes/43/${nombre}.png`, "https://otro.test/foto.png"])("ignora una URL no gestionada o de otra publicación: %j", async (url) => {
        await eliminarImagenProductor(url, 42);
        expect(mocks.unlink).not.toHaveBeenCalled();
    });

    it("tolera que el archivo ya no exista", async () => {
        mocks.unlink.mockRejectedValue(Object.assign(new Error("No existe"), { code: "ENOENT" }));
        await expect(eliminarImagenProductor(`/api/publicaciones/imagenes/42/${nombre}.png`, 42)).resolves.toBeUndefined();
    });

    it("propaga errores de eliminación distintos de archivo inexistente", async () => {
        const error = Object.assign(new Error("Sin permisos"), { code: "EACCES" });
        mocks.unlink.mockRejectedValue(error);
        await expect(eliminarImagenProductor(`/api/publicaciones/imagenes/42/${nombre}.png`, 42)).rejects.toBe(error);
    });
});
