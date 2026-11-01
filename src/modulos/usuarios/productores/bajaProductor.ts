"use server"

import { db } from "@/infraestructura/persistencia/prisma/db";
import { validarBajaProductor } from "./validarBajaProductor";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { eliminarImagenPublicacionGestionada } from "@/modulos/publicaciones/operadores/imagenes-publicacion";
import { imagenes } from "@/infraestructura/imagenes/imagenes";

export type ResultadoBajaProductor =
	| { esValido: false; errores: string[] }
	| { esValido: true; mensaje: string };

export async function bajaProductor(valor: unknown): Promise<ResultadoBajaProductor> {
	await controlarSesionEnAccion(exigirAdministrador);

	const validacion = validarBajaProductor(valor);
	if (!validacion.esValido) return validacion;

	const { productorId } = validacion.datos;

	const resultado = await db.transaction(async (tx) => {
		await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1720, ${productorId})`
			.returnsRow({ locked: "pg/int4@1" }).build());
		const productor = await tx.orm.public.Productor.where({ id: productorId }).first();
		if (!productor) return { error: "El productor seleccionado ya no existe.", fotos: [], fotoPerfil: null };

		const relaciones = await tx.orm.public.PublicacionProductor.where({ productorId }).all();
		const fotos: { publicacionId: number; url: string }[] = [];
		await tx.orm.public.PublicacionProductor.where({ productorId }).deleteAll();
		for (const relacion of relaciones) {
			const publicacion = await tx.orm.public.Publicacion.where({ id: relacion.publicacionId }).first();
			if (publicacion?.foto) fotos.push({ publicacionId: relacion.publicacionId, url: publicacion.foto });
			await tx.orm.public.Publicacion.where({ id: relacion.publicacionId }).delete();
		}

		await tx.orm.public.Productor.where({ id: productorId }).delete();
		await tx.orm.public.Usuario.where({ id: productor.usuarioId }).delete();
		return { error: null, fotos, fotoPerfil: productor.fotoPerfil };
	});

	if (resultado.error) {
		return { esValido: false, errores: [resultado.error] };
	}

	for (const foto of resultado.fotos) {
		try {
			await eliminarImagenPublicacionGestionada(foto.url, foto.publicacionId);
		} catch (error) {
			console.error("No se pudo eliminar una imagen del productor dado de baja.", error);
		}
	}
	if (resultado.fotoPerfil) {
		try {
			await imagenes.eliminar(resultado.fotoPerfil, "productores", productorId);
		} catch (error) {
			console.error("No se pudo eliminar la foto de perfil del productor dado de baja.", error);
		}
	}

	revalidatePath("/administracion");
	revalidatePath("/productores");

	return { esValido: true, mensaje: "Productor eliminado correctamente." };
}
