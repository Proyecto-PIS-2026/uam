import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const TAMANO_MAXIMO = 10 * 1024 * 1024;
const PREFIJO_URL = "/api/publicaciones/imagenes";

export class ErrorImagenProductor extends Error {}

function detectarExtension(contenido: Buffer): "jpg" | "png" | "webp" | null {
    if (contenido.length >= 4 && contenido[0] === 0xff && contenido[1] === 0xd8 && contenido[2] === 0xff && contenido.at(-2) === 0xff && contenido.at(-1) === 0xd9) return "jpg";
    if (contenido.length >= 8 && contenido.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
    if (contenido.length >= 12 && contenido.toString("ascii", 0, 4) === "RIFF" && contenido.toString("ascii", 8, 12) === "WEBP") return "webp";
    return null;
}

export async function guardarImagenProductor(publicacionId: number, fotografia: string): Promise<string> {
    const separador = fotografia.indexOf(",");
    const contenido = Buffer.from(fotografia.slice(separador + 1), "base64");
    if (contenido.length === 0 || contenido.length > TAMANO_MAXIMO) throw new ErrorImagenProductor("La imagen debe pesar entre 1 byte y 10 MB.");
    const extension = detectarExtension(contenido);
    if (!extension) throw new ErrorImagenProductor("La imagen debe ser JPEG, PNG o WebP.");

    const nombre = `${randomUUID()}.${extension}`;
    const directorio = join(process.cwd(), "storage", "publicaciones", String(publicacionId));
    await mkdir(directorio, { recursive: true });
    await writeFile(join(directorio, nombre), contenido, { flag: "wx" });
    return `${PREFIJO_URL}/${publicacionId}/${nombre}`;
}

export async function eliminarImagenProductor(url: string | null): Promise<void> {
    if (!url) return;
    const coincidencia = url.match(/^\/api\/publicaciones\/imagenes\/([1-9]\d*)\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/);
    if (!coincidencia) return;
    try {
        await unlink(join(process.cwd(), "storage", "publicaciones", coincidencia[1], coincidencia[2]));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
}
