import { db } from "../../infraestructura/persistencia/prisma/db";

export async function bajaPublicacionOperador(publicacionId: number, operadorId: number): Promise<boolean> {
	return db.transaction(async (tx) => {
		await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ${operadorId})`
			.returnsRow({ locked: "pg/int4@1" }).build());

		const relacion = await tx.orm.public.PublicacionOperador.where({ publicacionId, operadorId }).first();
		if (!relacion) {
			const publicacion = await tx.orm.public.Publicacion.where({ id: publicacionId }).first();
			return !publicacion;
		}
		await tx.orm.public.Publicacion.where({ id: publicacionId }).delete();
		return true;
	});
}
