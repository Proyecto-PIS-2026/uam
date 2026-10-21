"use server"

import { db } from "@/infraestructura/persistencia/prisma/db";
import { validarBajaProductor } from "./validarBajaProductor";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { eliminarImagenPublicacionGestionada } from "@/modulos/publicaciones/operadores/imagenes-publicacion";

export type ResultadoBajaProductor =
	| { esValido: false; errores: string[] }
	| { esValido: true; mensaje: string };

export async function bajaProductor(valor: unknown): Promise<ResultadoBajaProductor> {
	await exigirAdministrador();

	const validacion = validarBajaProductor(valor);
	if (!validacion.esValido) return validacion;

	const { productorId } = validacion.datos;

	const resultado = await db.transaction(async (tx) => {
		const productor = await tx.orm.public.Productor.where({ id: productorId }).first();
		if (!productor) return { error: "El productor seleccionado ya no existe.", fotos: [] };

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
		return { error: null, fotos };
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

	revalidatePath("/administracion");
	revalidatePath("/productores");

	return { esValido: true, mensaje: "Productor eliminado correctamente." };
}