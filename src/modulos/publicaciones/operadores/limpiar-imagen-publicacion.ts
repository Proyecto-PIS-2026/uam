import { db } from "@/infraestructura/persistencia/prisma/db";
import { eliminarImagenPublicacionGestionada } from "./imagenes-publicacion";

export async function limpiarImagenPublicacionNoReferenciada(url: string, publicacionId: number): Promise<void> {
    try {
        const publicacion = await db.orm.public.Publicacion.select("foto").where({ id: publicacionId }).first();
        if (publicacion?.foto !== url) await eliminarImagenPublicacionGestionada(url, publicacionId);
    } catch (error) {
        console.error("No se pudo confirmar la limpieza de una imagen de publicación.", error);
    }
}
