import { leerImagenPublicacion, tipoContenidoImagen } from "../../../../../../modulos/publicaciones/operadores/imagenes-publicacion";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerOperadorAutorizado } from "@/modulos/usuarios/operadores/operador-actual";

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
        const sesion = await obtenerSesion();
        const esOperador = sesion?.rol === "OPERADOR";
        const publicacion = await db.orm.public.Publicacion.select("id").where({ id }).first();
        if (!publicacion) {
            return new Response("Imagen no encontrada", {
                status: 404,
                headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" },
            });
        }
        if (esOperador) {
            const operador = await obtenerOperadorAutorizado();
            const publicacionPropia = await db.orm.public.PublicacionOperador
                .select("id")
                .where({ publicacionId: id, operadorId: operador.id })
                .first();
            if (!publicacionPropia) {
                throw new ErrorAutorizacion(403, "La publicación no corresponde al operador autenticado.");
            }
        }
        const contenido = await leerImagenPublicacion(id, archivo);
        return new Response(new Uint8Array(contenido), {
            headers: {
                "Content-Type": tipoContenido,
                "Content-Length": String(contenido.length),
                "Cache-Control": esOperador ? "private, no-store" : "public, max-age=31536000, immutable",
                "Vary": "Cookie",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error) {
        if (error instanceof ErrorAutorizacion) {
            return new Response(error.message, {
                status: error.status,
                headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" },
            });
        }
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return new Response("Imagen no encontrada", {
                status: 404,
                headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" },
            });
        }
        throw error;
    }
}