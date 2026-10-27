import { db } from "../../infraestructura/persistencia/prisma/db";
import { eliminarImagenProductor } from "./imagenes-productor";

export async function bajaPublicacionProductor(publicacionId: number, productorId: number): Promise<boolean> {
    const resultado = await db.transaction(async (tx) => {
        await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1720, ${productorId})`
            .returnsRow({ locked: "pg/int4@1" }).build());

        // Usa el mismo orden de bloqueo que la edición: relación antes de publicación.
        await tx.execute(db.raw.sql`SELECT id FROM "publicacionProductor" WHERE "publicacionId" = ${publicacionId} AND "productorId" = ${productorId} FOR UPDATE`
            .returnsRow({ id: "pg/int4@1" }).build());

        const relacion = await tx.orm.public.PublicacionProductor.where({ publicacionId, productorId }).first();
        const publicacion = await tx.orm.public.Publicacion.where({ id: publicacionId }).first();
        if (!relacion) return { eliminada: !publicacion, foto: null };

        await tx.orm.public.Publicacion.where({ id: publicacionId }).delete();
        return { eliminada: true, foto: publicacion?.foto ?? null };
    });

    if (resultado.eliminada && resultado.foto) {
        try {
            await eliminarImagenProductor(resultado.foto, publicacionId);
        } catch (error) {
            console.error("No se pudo eliminar la imagen de la publicación dada de baja.", error);
        }
    }
    return resultado.eliminada;
}
