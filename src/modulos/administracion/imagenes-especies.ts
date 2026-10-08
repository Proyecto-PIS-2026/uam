import { db } from "@/infraestructura/persistencia/prisma/db";

const TAMANO_MAXIMO = 10 * 1024 * 1024;

export class ErrorImagenEspecie extends Error {}

function validarEspecieId(especieId: number) {
    if (!Number.isSafeInteger(especieId) || especieId <= 0) {
        throw new ErrorImagenEspecie(
            "El identificador de la especie no es válido.",
        );
    }
}

function extensionImagen(contenido: Buffer): "jpg" | "png" | "webp" | null {
    if (contenido.length >= 4 && contenido[0] === 0xff && contenido[1] === 0xd8 && contenido[2] === 0xff && contenido.at(-2) === 0xff && contenido.at(-1) === 0xd9) {
        return "jpg";
    }
    if (contenido.length >= 8 && contenido.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26,10]))) {
        return "png";
    }
    if (contenido.length >= 12 && contenido.toString("ascii", 0, 4) === "RIFF" && contenido.toString("ascii", 8, 12) === "WEBP") {
        return "webp";
    }
    return null;
}

async function convertirImagenABase64(archivo: File): Promise<string> {
    if (!archivo || typeof archivo.arrayBuffer !== "function" || archivo.size === 0 || archivo.size > TAMANO_MAXIMO) {
        throw new ErrorImagenEspecie(
            "La imagen debe pesar entre 1 byte y 10 MB.",
        );
    }
    const contenido = Buffer.from(await archivo.arrayBuffer(),);

    if (contenido.length === 0 || contenido.length > TAMANO_MAXIMO) {
        throw new ErrorImagenEspecie(
            "La imagen debe pesar entre 1 byte y 10 MB.",
        );
    }
    const extension = extensionImagen(contenido);
    if (!extension) {
        throw new ErrorImagenEspecie(
            "La imagen debe ser JPEG, PNG o WebP.",
        );
    }
    const tipo = extension === "jpg" ? "jpeg" : extension;
    return `data:image/${tipo};base64,${contenido.toString("base64")}`;
}

export async function guardarFotoEspecie(especieId: number,archivo: File): Promise<string> {
    validarEspecieId(especieId);
    const especie = await db.orm.public.Especie
        .select("id")
        .where({ id: especieId })
        .first();
    if (!especie) {
        throw new ErrorImagenEspecie(
            "No se encontró la especie.",
        );
    }
    const fotoEspecie = await convertirImagenABase64(archivo);
    await db.orm.public.Especie
        .where({ id: especieId })
        .update({
            fotoEspecie,
        });
    return fotoEspecie;
}

export async function eliminarFotoEspecie(especieId: number): Promise<void> {
    validarEspecieId(especieId);
    const especie = await db.orm.public.Especie
        .select("id")
        .where({ id: especieId })
        .first();

    if (!especie) {
        throw new ErrorImagenEspecie(
            "No se encontró la especie.",
        );
    }

    await db.orm.public.Especie
        .where({ id: especieId })
        .update({
            fotoEspecie: null,
        });
}