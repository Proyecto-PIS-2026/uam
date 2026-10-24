import { db } from "@/infraestructura/persistencia/prisma/db";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { bajaPublicacionProductor } from "../bajaPublicacionProductor";

type Sesion = NonNullable<Awaited<ReturnType<typeof obtenerSesion>>>;

export class ErrorBajaPublicacionProductor extends Error {
    readonly status = 404;

    constructor(mensaje: string) {
        super(mensaje);
        this.name = "ErrorBajaPublicacionProductor";
    }
}

export async function bajaPublicacionProductorAutorizada(sesion: Sesion, publicacionProductorId: number): Promise<{ productorId: number }> {
    const relacion = await db.orm.public.PublicacionProductor.where({ id: publicacionProductorId }).first();
    if (!relacion) throw new ErrorBajaPublicacionProductor("La publicación no existe o ya fue eliminada.");

    const productor = await db.orm.public.Productor.where({ id: relacion.productorId }).select("id", "usuarioId").first();
    if (!productor) throw new ErrorBajaPublicacionProductor("La publicación no existe o ya fue eliminada.");

    const puede = autorizado("administracion.publicacion.eliminar", sesion) ||
        autorizado("productor.publicacion.eliminar", sesion, productor);
    if (!puede) throw new ErrorAutorizacion(403, "No tenés permiso para eliminar esta publicación.");

    const eliminada = await bajaPublicacionProductor(relacion.publicacionId, productor.id);
    if (!eliminada) throw new ErrorBajaPublicacionProductor("La publicación no pertenece al Productor.");
    return { productorId: productor.id };
}