import { db } from "../../infraestructura/persistencia/prisma/db";
import { eliminarImagenPublicacionGestionada } from "./operadores/imagenes-publicacion";
import { notificarCambioPublicacion } from "@/infraestructura/tiempo-real/publicaciones";

export async function bajaPublicacionOperador(publicacionId: number, operadorId: number): Promise<boolean> {
	const resultado = await db.transaction(async (tx) => {
		await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ${operadorId})`
			.returnsRow({ locked: "pg/int4@1" }).build());

		const relacion = await tx.orm.public.PublicacionOperador.where({ publicacionId, operadorId }).first();
		if (!relacion) {
			const publicacion = await tx.orm.public.Publicacion.where({ id: publicacionId }).first();
			return { eliminada: !publicacion, foto: null };
		}
		const publicacion = await tx.orm.public.Publicacion.where({ id: publicacionId }).first();
		await tx.orm.public.Publicacion.where({ id: publicacionId }).delete();
		await notificarCambioPublicacion(tx, { operadorId, publicacionId });
		return { eliminada: true, foto: publicacion?.foto ?? null };
	});

	if (resultado.eliminada && resultado.foto) {
		try {
			await eliminarImagenPublicacionGestionada(resultado.foto, publicacionId);
		} catch (error) {
			console.error("No se pudo eliminar la imagen de la publicación dada de baja.", error);
		}
	}
	return resultado.eliminada;
}
