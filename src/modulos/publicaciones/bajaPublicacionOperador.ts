import { db } from "../../infraestructura/persistencia/prisma/db";

export async function bajaPublicacionOperador(publicacionId: number, operadorId: number): Promise<boolean> {
	return db.transaction(async (tx) => {
		const relacion = await tx.orm.public.PublicacionOperador.where({ publicacionId, operadorId }).first();
		if (!relacion) return false;
		await tx.orm.public.Publicacion.where({ id: publicacionId }).delete();
		return true;
	});
}
