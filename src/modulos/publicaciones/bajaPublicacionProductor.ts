
import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";

import { db } from "../../infraestructura/persistencia/prisma/db";
import { eliminarImagenProductor } from "./imagenes-productor";

export async function bajaPublicacionProductor(
    publicacionId: number,
    productorId: number,
): Promise<boolean> {
    const resultado = await db.transaction(async (tx) => {
        await tx.execute(
            db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1720, ${productorId})`
                .returnsRow({ locked: "pg/int4@1" }).build(),
        );

        await tx.execute(
            db.raw.sql`SELECT id FROM "publicacionProductor" WHERE "publicacionId" = ${publicacionId} AND "productorId" = ${productorId} FOR UPDATE`
                .returnsRow({ id: "pg/int4@1" }).build(),
        );

        const relacion = await tx.orm.public.PublicacionProductor
            .where({ publicacionId, productorId })
            .first();

        const publicacion = await tx.orm.public.Publicacion
            .where({ id: publicacionId })
            .first();

        if (!relacion) {
            return {
                eliminada: !publicacion,
                foto: null,
            };
        }

        const productor = await tx.orm.public.Productor
            .where({ id: productorId })
            .first();

        if (!productor) {
            throw new Error("No se encontró el productor asociado a la publicación.");
        }

        const usuario = await tx.orm.public.Usuario
            .where({ id: productor.usuarioId })
            .first();

        if (!usuario) {
            throw new Error("No se encontró el usuario asociado al productor.");
        }

        await tx.orm.public.Publicacion
            .where({ id: publicacionId })
            .delete();

        const relacionesRestantes = await tx.orm.public.PublicacionProductor
            .where({ productorId })
            .all();

        const fechaStr = new Date().toISOString().slice(0, 10);
        const fecha = Temporal.Instant.from(`${fechaStr}T00:00:00Z`);

        const estadisticaExistente = await tx.orm.public.EstadisticaCantidadPublicacion
            .where({
                fecha,
                username: usuario.username,
            })
            .first();

        if (estadisticaExistente) {
            await tx.orm.public.EstadisticaCantidadPublicacion
                .where({ id: estadisticaExistente.id })
                .update({
                    cantidad: relacionesRestantes.length,
                });
        } else {
            await tx.orm.public.EstadisticaCantidadPublicacion.create({
                fecha,
                username: usuario.username,
                cantidad: relacionesRestantes.length,
            });
        }

        return {
            eliminada: true,
            foto: publicacion?.foto ?? null,
        };
    });

    if (resultado.eliminada && resultado.foto) {
        try {
            await eliminarImagenProductor(
                resultado.foto,
                publicacionId,
            );
        } catch (error) {
            console.error(
                "No se pudo eliminar la imagen de la publicación dada de baja.",
                error,
            );
        }
    }

    return resultado.eliminada;
}
