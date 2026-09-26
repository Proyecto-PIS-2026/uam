import { leerImagenPublicacion, tipoContenidoImagen } from "../../../../../../modulos/publicaciones/operadores/imagenes-publicacion";

export const runtime = "nodejs";

type Contexto = {
    params: Promise<{ publicacionId: string; archivo: string }>;
};

export async function GET(_pedido: Request, contexto: Contexto): Promise<Response> {
    const { publicacionId, archivo } = await contexto.params;

    if (!/^[1-9]\d*$/.test(publicacionId)) {
        return new Response("Imagen no encontrada", { status: 404 });
    }

    const id = Number(publicacionId);
    const tipoContenido = tipoContenidoImagen(archivo);
    if (!Number.isSafeInteger(id) || !tipoContenido) {
        return new Response("Imagen no encontrada", { status: 404 });
    }

    try {
        const contenido = await leerImagenPublicacion(id, archivo);
        return new Response(new Uint8Array(contenido), {
            headers: {
                "Content-Type": tipoContenido,
                "Content-Length": String(contenido.length),
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return new Response("Imagen no encontrada", { status: 404 });
        }
        throw error;
    }
}
