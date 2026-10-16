import { File as NodeFile } from "node:buffer";
import { join } from "node:path";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    ErrorImagenPublicacion,
    eliminarImagenPublicacionGestionada,
    guardarImagenPublicacion,
    leerImagenPublicacion,
    tipoContenidoImagen,
} from "./imagenes-publicacion";
import { AlmacenamientoImagenesFilesystem } from "@/infraestructura/imagenes/almacenamiento-filesystem";
import { crearServicioImagenes } from "@/infraestructura/imagenes/imagenes";

const archivos = vi.hoisted(() => ({ mkdir: vi.fn(), readFile: vi.fn(), writeFile: vi.fn(), unlink: vi.fn() }));
vi.mock("node:fs/promises", () => ({ ...archivos, default: archivos }));

const UUID = "12345678-1234-4234-8234-123456789abc";
const NOMBRE = `${UUID}.png`;
const URL = `/api/publicaciones/imagenes/42/${NOMBRE}`;
const CLAVE = `publicaciones/42/${NOMBRE}`;
const MAXIMO = 10 * 1024 * 1024;

function archivo(contenido: Buffer, tamano = contenido.length): File {
    const foto = new NodeFile([new Uint8Array(contenido)], "archivo.txt", { type: "text/plain" });
    Object.defineProperty(foto, "size", { value: tamano });
    return foto as unknown as File;
}

async function foto(formato: "png" | "jpeg" | "webp" = "png", width = 20, height = 10) {
    return sharp({ create: { width, height, channels: 3, background: "#229944" } }).toFormat(formato).toBuffer();
}

beforeEach(() => {
    vi.resetAllMocks();
    archivos.mkdir.mockResolvedValue(undefined);
    archivos.writeFile.mockResolvedValue(undefined);
    archivos.unlink.mockResolvedValue(undefined);
});

describe("almacenamiento de imágenes", () => {
    it.each(["png", "jpeg", "webp"] as const)("guarda %s en filesystem y devuelve una URL sin base64", async (formato) => {
        const url = await guardarImagenPublicacion(42, archivo(await foto(formato)));
        expect(url).toMatch(/^\/api\/publicaciones\/imagenes\/42\/[a-f0-9-]+\.webp$/);
        const [ruta, contenido, opciones] = archivos.writeFile.mock.calls[0];
        expect(ruta).toBe(join(process.cwd(), "storage", "publicaciones", "42", url.split("/").at(-1)!));
        expect(opciones).toEqual({ flag: "wx", mode: 0o600 });
        expect((await sharp(contenido).metadata()).format).toBe("webp");
    });

    it("usa el mismo almacenamiento para el alta codificada y la edición con File", async () => {
        const contenido = await foto();
        const url = await guardarImagenPublicacion(42, `data:image/png;base64,${contenido.toString("base64")}`);
        expect(url).toContain("/api/publicaciones/imagenes/42/");
        expect(archivos.writeFile).toHaveBeenCalledOnce();
    });

    it("reduce las dimensiones y retira los metadatos", async () => {
        const contenido = await sharp(await foto("jpeg", 2000, 1000)).withExif({ IFD0: { Artist: "Privado" } }).jpeg().toBuffer();
        await guardarImagenPublicacion(42, archivo(contenido));
        const metadata = await sharp(archivos.writeFile.mock.calls[0][1]).metadata();
        expect(metadata.width).toBe(1600);
        expect(metadata.height).toBe(800);
        expect(metadata.exif).toBeUndefined();
    });

    it("permite sustituir el adaptador sin cambiar el servicio", async () => {
        const adaptador = { guardar: vi.fn().mockResolvedValue(undefined), leer: vi.fn(), eliminar: vi.fn() };
        const servicio = crearServicioImagenes(adaptador);
        const url = await servicio.guardar("productores", 9, archivo(await foto()));
        expect(url).toContain("/api/imagenes/productores/9/");
        expect(adaptador.guardar).toHaveBeenCalledOnce();
        expect(archivos.writeFile).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rechaza el destino %s", async (id) => {
        await expect(guardarImagenPublicacion(id, archivo(await foto()))).rejects.toBeInstanceOf(ErrorImagenPublicacion);
        expect(archivos.writeFile).not.toHaveBeenCalled();
    });

    it.each([
        Buffer.from("texto"),
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]),
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
    ])("rechaza una firma engañosa o un formato no admitido", async (contenido) => {
        await expect(guardarImagenPublicacion(42, archivo(contenido))).rejects.toThrow("JPEG, PNG o WebP");
        expect(archivos.writeFile).not.toHaveBeenCalled();
    });

    it.each([
        null,
        { size: 10 },
        archivo(Buffer.alloc(0)),
        archivo(Buffer.alloc(1), MAXIMO + 1),
        archivo(Buffer.alloc(MAXIMO + 1), 1),
    ])("rechaza entradas vacías y tamaños fuera del límite", async (entrada) => {
        await expect(guardarImagenPublicacion(42, entrada as File)).rejects.toThrow("10 MB");
        expect(archivos.writeFile).not.toHaveBeenCalled();
    });

    it.each(["data:image/png;base64,A", "data:image/png;base64,====", "https://host/foto.png", "data:image/gif;base64,YWJj"])("rechaza codificación %s", async (entrada) => {
        await expect(guardarImagenPublicacion(42, entrada)).rejects.toBeInstanceOf(ErrorImagenPublicacion);
    });

    it("limpia un archivo parcial si falla la escritura y conserva el error", async () => {
        const error = Object.assign(new Error("Disco lleno"), { code: "ENOSPC" });
        archivos.writeFile.mockRejectedValueOnce(error);
        await expect(guardarImagenPublicacion(42, archivo(await foto()))).rejects.toBe(error);
        expect(archivos.unlink).toHaveBeenCalledWith(archivos.writeFile.mock.calls[0][0]);
    });

    it("no sobrescribe ni elimina un archivo existente", async () => {
        const error = Object.assign(new Error("Existe"), { code: "EEXIST" });
        archivos.writeFile.mockRejectedValueOnce(error);
        await expect(new AlmacenamientoImagenesFilesystem().guardar(CLAVE, Buffer.from("foto"))).rejects.toBe(error);
        expect(archivos.unlink).not.toHaveBeenCalled();
    });

    it("sigue leyendo imágenes heredadas almacenadas en filesystem", async () => {
        const contenido = await foto();
        archivos.readFile.mockResolvedValue(contenido);
        await expect(leerImagenPublicacion(42, NOMBRE)).resolves.toBe(contenido);
        expect(archivos.readFile).toHaveBeenCalledWith(join(process.cwd(), "storage", "publicaciones", "42", NOMBRE));
    });

    it.each([`../${NOMBRE}`, `${NOMBRE}/otro`, `..%2F${NOMBRE}`, "foto.png", `${UUID}.svg`])("impide nombres o rutas no gestionadas %s", async (nombre) => {
        await expect(leerImagenPublicacion(42, nombre)).rejects.toBeInstanceOf(ErrorImagenPublicacion);
        expect(archivos.readFile).not.toHaveBeenCalled();
    });

    it.each([`../${CLAVE}`, `publicaciones/42/../${NOMBRE}`, `publicaciones\\42\\${NOMBRE}`, `otro/42/${NOMBRE}`])("el adaptador también valida las claves %s", async (clave) => {
        await expect(new AlmacenamientoImagenesFilesystem().leer(clave)).rejects.toBeInstanceOf(ErrorImagenPublicacion);
        expect(archivos.readFile).not.toHaveBeenCalled();
    });

    it("elimina exclusivamente el archivo gestionado propio y tolera su ausencia", async () => {
        archivos.unlink.mockRejectedValue(Object.assign(new Error("No existe"), { code: "ENOENT" }));
        await expect(eliminarImagenPublicacionGestionada(URL, 42)).resolves.toBeUndefined();
        expect(archivos.unlink).toHaveBeenCalledWith(join(process.cwd(), "storage", "publicaciones", "42", NOMBRE));
    });

    it.each([null, "", "/generico/acelga.jpg", "data:image/png;base64,YWJj", URL.replace("/42/", "/43/"), URL + "?a=1"])("conserva referencias que no pertenecen a la publicación %s", async (url) => {
        await eliminarImagenPublicacionGestionada(url, 42);
        expect(archivos.unlink).not.toHaveBeenCalled();
    });

    it.each([["jpg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]])("identifica el tipo seguro %s", (extension, tipo) => {
        expect(tipoContenidoImagen(`${UUID}.${extension}`)).toBe(tipo);
        expect(tipoContenidoImagen(`otro.${extension}`)).toBeNull();
    });
});
