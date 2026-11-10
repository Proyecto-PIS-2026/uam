
import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";

import { db } from "../../infraestructura/persistencia/prisma/db";
import { eliminarImagenPublicacionGestionada } from "./operadores/imagenes-publicacion";
import { notificarCambioPublicacion } from "@/infraestructura/tiempo-real/publicaciones";

export async function bajaPublicacionOperador(
    publicacionId: number,
    operadorId: number,
): Promise<boolean> {
    const resultado = await db.transaction(async (tx) => {
        await tx.execute(
            db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ${operadorId})`
                .returnsRow({ locked: "pg/int4@1" }).build(),
        );

        const relacion = await tx.orm.public.PublicacionOperador
            .where({ publicacionId, operadorId })
            .first();

        if (!relacion) {
            const publicacion = await tx.orm.public.Publicacion
                .where({ id: publicacionId })
                .first();

            return {
                eliminada: !publicacion,
                foto: null,
            };
        }

        const operador = await tx.orm.public.Operador
            .where({ id: operadorId })
            .first();

        if (!operador) {
            throw new Error("No se encontró el operador asociado a la publicación.");
        }

        const usuario = await tx.orm.public.Usuario
            .where({ id: operador.usuarioId })
            .first();

        if (!usuario) {
            throw new Error("No se encontró el usuario asociado al operador.");
        }

        const publicacion = await tx.orm.public.Publicacion
            .where({ id: publicacionId })
            .first();

        await tx.orm.public.Publicacion
            .where({ id: publicacionId })
            .delete();

        const relacionesRestantes = await tx.orm.public.PublicacionOperador
            .where({ operadorId })
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

        await notificarCambioPublicacion(tx, {
            operadorId,
            publicacionId,
        });

        return {
            eliminada: true,
            foto: publicacion?.foto ?? null,
        };
    });

    if (resultado.eliminada && resultado.foto) {
        try {
            await eliminarImagenPublicacionGestionada(
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
