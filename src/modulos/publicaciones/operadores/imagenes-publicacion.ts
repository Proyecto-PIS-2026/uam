import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const TAMANO_MAXIMO = 5 * 1024 * 1024;
const PREFIJO_URL = "/api/publicaciones/imagenes";
const NOMBRE_ARCHIVO_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export class ErrorImagenPublicacion extends Error {}

function directorioPublicacion(publicacionId: number): string {
    if (!Number.isSafeInteger(publicacionId) || publicacionId <= 0) {
        throw new ErrorImagenPublicacion("El identificador de la publicación no es válido.");
    }

    return join(process.cwd(), "storage", "publicaciones", String(publicacionId));
}

function extensionImagen(contenido: Buffer): "jpg" | "png" | "webp" | null {
    if (contenido.length >= 4 && contenido[0] === 0xff && contenido[1] === 0xd8 && contenido[2] === 0xff && contenido.at(-2) === 0xff && contenido.at(-1) === 0xd9) {
        return "jpg";
    }

    if (contenido.length >= 8 && contenido.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        return "png";
    }

    if (contenido.length >= 12 && contenido.toString("ascii", 0, 4) === "RIFF" && contenido.toString("ascii", 8, 12) === "WEBP") {
        return "webp";
    }

    return null;
}

function rutaImagen(publicacionId: number, nombreArchivo: string): string {
    if (!NOMBRE_ARCHIVO_VALIDO.test(nombreArchivo)) {
        throw new ErrorImagenPublicacion("El nombre de la imagen no es válido.");
    }

    return join(directorioPublicacion(publicacionId), nombreArchivo);
}

export async function guardarImagenPublicacion(publicacionId: number, archivo: File): Promise<string> {
    const directorio = directorioPublicacion(publicacionId);

    if (!archivo || typeof archivo.arrayBuffer !== "function" || archivo.size === 0 || archivo.size > TAMANO_MAXIMO) {
        throw new ErrorImagenPublicacion("La imagen debe pesar entre 1 byte y 5 MB.");
    }

    const contenido = Buffer.from(await archivo.arrayBuffer());
    if (contenido.length === 0 || contenido.length > TAMANO_MAXIMO) {
        throw new ErrorImagenPublicacion("La imagen debe pesar entre 1 byte y 5 MB.");
    }

    const extension = extensionImagen(contenido);
    if (!extension) {
        throw new ErrorImagenPublicacion("La imagen debe ser JPEG, PNG o WebP.");
    }

    const nombreArchivo = `${randomUUID()}.${extension}`;
    await mkdir(directorio, { recursive: true });
    await writeFile(join(directorio, nombreArchivo), contenido, { flag: "wx" });

    return `${PREFIJO_URL}/${publicacionId}/${nombreArchivo}`;
}

export async function leerImagenPublicacion(publicacionId: number, nombreArchivo: string): Promise<Buffer> {
    return readFile(rutaImagen(publicacionId, nombreArchivo));
}

export async function eliminarImagenPublicacionGestionada(url: string | null, publicacionId: number): Promise<void> {
    if (!url) return;

    const prefijo = `${PREFIJO_URL}/${publicacionId}/`;
    if (!url.startsWith(prefijo)) return;

    const nombreArchivo = url.slice(prefijo.length);
    if (!NOMBRE_ARCHIVO_VALIDO.test(nombreArchivo)) return;

    try {
        await unlink(rutaImagen(publicacionId, nombreArchivo));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
}

export function tipoContenidoImagen(nombreArchivo: string): string | null {
    if (!NOMBRE_ARCHIVO_VALIDO.test(nombreArchivo)) return null;
    if (nombreArchivo.endsWith(".jpg")) return "image/jpeg";
    if (nombreArchivo.endsWith(".png")) return "image/png";
    return "image/webp";
}
