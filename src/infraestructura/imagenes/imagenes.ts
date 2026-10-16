import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { AlmacenamientoImagenesFilesystem } from "./almacenamiento-filesystem";
import {
    type AlmacenamientoImagenes,
    type CategoriaImagen,
    ErrorImagen,
    claveDesdeUrlImagen,
    claveImagen,
    urlImagen,
    validarDestinoImagen,
} from "./almacenamiento-imagenes";

export const TAMANO_MAXIMO_IMAGEN = 10 * 1024 * 1024;
export const DIMENSION_MAXIMA_IMAGEN = 1600;
const MAXIMO_PIXELES = 40_000_000;

export function decodificarImagenBase64(valor: string): Buffer {
    if (valor.length > Math.ceil(TAMANO_MAXIMO_IMAGEN / 3) * 4 + 40) {
        throw new ErrorImagen("La imagen debe pesar entre 1 byte y 10 MB.");
    }
    const coincidencia = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(valor);
    if (!coincidencia || coincidencia[1].length % 4 !== 0) {
        throw new ErrorImagen("La imagen debe ser JPEG, PNG o WebP.");
    }
    const contenido = Buffer.from(coincidencia[1], "base64");
    if (contenido.toString("base64") !== coincidencia[1]) throw new ErrorImagen("La imagen codificada no es válida.");
    return contenido;
}

async function optimizarImagen(contenido: Buffer): Promise<Buffer> {
    if (contenido.length === 0 || contenido.length > TAMANO_MAXIMO_IMAGEN) {
        throw new ErrorImagen("La imagen debe pesar entre 1 byte y 10 MB.");
    }
    try {
        const imagen = sharp(contenido, { limitInputPixels: MAXIMO_PIXELES, failOn: "warning" });
        const metadata = await imagen.metadata();
        if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format) || (metadata.pages ?? 1) > 1) {
            throw new ErrorImagen("La imagen debe ser JPEG, PNG o WebP sin animación.");
        }
        return await imagen.rotate().resize({
            width: DIMENSION_MAXIMA_IMAGEN,
            height: DIMENSION_MAXIMA_IMAGEN,
            fit: "inside",
            withoutEnlargement: true,
        }).webp({ quality: 82 }).toBuffer();
    } catch (error) {
        if (error instanceof ErrorImagen) throw error;
        throw new ErrorImagen("La imagen debe ser JPEG, PNG o WebP y contener una imagen válida de hasta 40 megapíxeles.");
    }
}

export function crearServicioImagenes(almacenamiento: AlmacenamientoImagenes) {
    return {
        async guardar(categoria: CategoriaImagen, id: number, archivo: File | string): Promise<string> {
            validarDestinoImagen(categoria, id);
            let contenido: Buffer;
            if (typeof archivo === "string") {
                contenido = decodificarImagenBase64(archivo);
            } else {
                if (!archivo || typeof archivo.arrayBuffer !== "function" || archivo.size <= 0 || archivo.size > TAMANO_MAXIMO_IMAGEN) {
                    throw new ErrorImagen("La imagen debe pesar entre 1 byte y 10 MB.");
                }
                contenido = Buffer.from(await archivo.arrayBuffer());
            }
            const optimizada = await optimizarImagen(contenido);
            const nombre = `${randomUUID()}.webp`;
            await almacenamiento.guardar(claveImagen(categoria, id, nombre), optimizada);
            return urlImagen(categoria, id, nombre);
        },
        async leer(categoria: CategoriaImagen, id: number, archivo: string): Promise<Buffer> {
            return almacenamiento.leer(claveImagen(categoria, id, archivo));
        },
        async eliminar(url: string | null, categoria: CategoriaImagen, id: number): Promise<void> {
            if (!url) return;
            const clave = claveDesdeUrlImagen(url, categoria, id);
            if (clave) await almacenamiento.eliminar(clave);
        },
    };
}

export const imagenes = crearServicioImagenes(new AlmacenamientoImagenesFilesystem());
