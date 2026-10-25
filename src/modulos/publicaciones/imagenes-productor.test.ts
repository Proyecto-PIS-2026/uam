// @vitest-environment node

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ crear: vi.fn(), leer: vi.fn(), eliminar: vi.fn() }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { orm: { public: { Imagen: {
    create: mocks.crear,
    select: () => ({ where: (filtro: unknown) => ({ first: () => mocks.leer(filtro) }) }),
    where: (filtro: unknown) => ({ deleteAll: () => mocks.eliminar(filtro) }),
} } } } }));
vi.mock("node:crypto", () => ({ randomUUID: () => "12345678-1234-4234-8234-123456789abc" }));

import { eliminarImagenProductor, ErrorImagenProductor, guardarImagenProductor } from "./imagenes-productor";

const nombre = "12345678-1234-4234-8234-123456789abc";
const clave = `publicaciones/42/${nombre}.webp`;

async function imagen(formato: "png" | "jpeg" | "webp" = "png", width = 20, height = 10) {
    const contenido = await sharp({ create: { width, height, channels: 3, background: "#229944" } }).toFormat(formato).toBuffer();
    return `data:image/${formato};base64,${contenido.toString("base64")}`;
}

describe("imágenes de publicaciones de Productor", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.crear.mockResolvedValue(undefined);
        mocks.eliminar.mockResolvedValue(undefined);
    });
    afterEach(() => vi.restoreAllMocks());

    it.each(["png", "jpeg", "webp"] as const)("normaliza %s a WebP con el almacenamiento común", async (formato) => {
        const url = await guardarImagenProductor(42, await imagen(formato));
        expect(url).toBe(`/api/publicaciones/imagenes/42/${nombre}.webp`);
        expect(mocks.crear).toHaveBeenCalledExactlyOnceWith({ clave, contenido: expect.any(Buffer) });
        expect((await sharp(mocks.crear.mock.calls[0][0].contenido).metadata()).format).toBe("webp");
    });

    it("reduce las fotografías grandes del Productor a 1600 píxeles", async () => {
        await guardarImagenProductor(42, await imagen("jpeg", 2000, 1000));
        const metadata = await sharp(mocks.crear.mock.calls[0][0].contenido).metadata();
        expect(metadata.width).toBe(1600);
        expect(metadata.height).toBe(800);
    });

    it.each([Buffer.alloc(0), Buffer.alloc(10 * 1024 * 1024 + 1)])("rechaza tamaño inválido sin escribir en PostgreSQL", async (contenido) => {
        await expect(guardarImagenProductor(42, `data:image/png;base64,${contenido.toString("base64")}`)).rejects.toBeInstanceOf(ErrorImagenProductor);
        expect(mocks.crear).not.toHaveBeenCalled();
    });

    it.each([Buffer.from("GIF89a"), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0]), Buffer.from("RIFF0000WEBP")])("rechaza firmas de imagen incompletas o contenido inválido", async (contenido) => {
        await expect(guardarImagenProductor(42, `data:image/png;base64,${contenido.toString("base64")}`)).rejects.toBeInstanceOf(ErrorImagenProductor);
        expect(mocks.crear).not.toHaveBeenCalled();
    });

    it("propaga el error de escritura", async () => {
        const error = new Error("Base de datos no disponible");
        mocks.crear.mockRejectedValue(error);
        await expect(guardarImagenProductor(42, await imagen())).rejects.toBe(error);
        expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it.each(["data:image/png;base64,A", "data:image/png;base64,====", "data:image/gif;base64,YWJj", "https://otro.test/foto.png"])("rechaza una codificación no admitida: %s", async (fotografia) => {
        await expect(guardarImagenProductor(42, fotografia)).rejects.toBeInstanceOf(ErrorImagenProductor);
        expect(mocks.crear).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rechaza el identificador %s antes de escribir", async (id) => {
        await expect(guardarImagenProductor(id, await imagen())).rejects.toBeInstanceOf(ErrorImagenProductor);
        expect(mocks.crear).not.toHaveBeenCalled();
    });

    it("elimina solamente la clave gestionada indicada por la URL", async () => {
        await eliminarImagenProductor(`/api/publicaciones/imagenes/42/${nombre}.png`, 42);
        expect(mocks.eliminar).toHaveBeenCalledExactlyOnceWith({ clave: `publicaciones/42/${nombre}.png` });
    });

    it.each([null, "", `/api/publicaciones/imagenes/42/../${nombre}.png`, `/api/publicaciones/imagenes/0/${nombre}.png`, `/api/publicaciones/imagenes/43/${nombre}.png`, "https://otro.test/foto.png"])("ignora una URL no gestionada o de otra publicación: %j", async (url) => {
        await eliminarImagenProductor(url, 42);
        expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it("tolera que la clave ya no exista", async () => {
        await expect(eliminarImagenProductor(`/api/publicaciones/imagenes/42/${nombre}.png`, 42)).resolves.toBeUndefined();
    });

    it("propaga los errores de eliminación de PostgreSQL", async () => {
        const error = new Error("Conexión interrumpida");
        mocks.eliminar.mockRejectedValue(error);
        await expect(eliminarImagenProductor(`/api/publicaciones/imagenes/42/${nombre}.png`, 42)).rejects.toBe(error);
    });
});
