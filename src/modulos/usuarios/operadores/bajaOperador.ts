"use server"

import { db } from "@/infraestructura/persistencia/prisma/db";
import { validarBajaOperador } from "./validarBajaOperador";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { eliminarImagenPublicacionGestionada } from "@/modulos/publicaciones/operadores/imagenes-publicacion";
import { imagenes } from "@/infraestructura/imagenes/imagenes";
import { notificarCambioCatalogoOperador } from "@/infraestructura/tiempo-real/publicaciones";

export type ResultadoBajaOperador =
	| { esValido: false; errores: string[] }
	| { esValido: true; mensaje: string };

export async function bajaOperador(valor: unknown): Promise<ResultadoBajaOperador> {
    await exigirAdministrador();

    const validacion = validarBajaOperador(valor);
	if (!validacion.esValido) return validacion;

    const { operadorId } = validacion.datos;

    const resultado = await db.transaction(async (tx) => {
		await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ${operadorId})`
			.returnsRow({ locked: "pg/int4@1" }).build());

		const operador = await tx.orm.public.Operador.where({ id: operadorId }).first();
		if (!operador) return { error: "El operador seleccionado ya no existe.", fotos: [], fotoPerfil: null };

		const relaciones = await tx.orm.public.PublicacionOperador.where({ operadorId }).all();
		const fotos: { publicacionId: number; url: string }[] = [];
		await tx.orm.public.PublicacionOperador.where({ operadorId }).deleteAll();
		for (const relacion of relaciones) {
			const publicacion = await tx.orm.public.Publicacion.where({ id: relacion.publicacionId }).first();
			if (publicacion?.foto) fotos.push({ publicacionId: relacion.publicacionId, url: publicacion.foto });
			await tx.orm.public.Publicacion.where({ id: relacion.publicacionId }).delete();
		}

		await tx.orm.public.Local.where({ operadorId }).deleteAll();
		await tx.orm.public.Operador.where({ id: operadorId }).delete();
		await tx.orm.public.Usuario.where({ id: operador.usuarioId }).delete();
		await notificarCambioCatalogoOperador(tx, operadorId);
		return { error: null, fotos, fotoPerfil: operador.fotoPerfil };
	});

	if (resultado.error) {
		return { esValido: false, errores: [resultado.error] };
	}

	for (const foto of resultado.fotos) {
		try {
			await eliminarImagenPublicacionGestionada(foto.url, foto.publicacionId);
		} catch (error) {
			console.error("No se pudo eliminar una imagen del operador dado de baja.", error);
		}
	}
	if (resultado.fotoPerfil) {
		try {
			await imagenes.eliminar(resultado.fotoPerfil, "operadores", operadorId);
		} catch (error) {
			console.error("No se pudo eliminar la foto de perfil del operador dado de baja.", error);
		}
	}

	revalidatePath("/administracion");
	revalidatePath("/inicio");
	revalidatePath("/publicaciones");
	revalidatePath("/operadores");
	revalidatePath("/operadores/[nombre]", "page");
	revalidatePath("/gestion-operadores/[id]", "page");
	revalidatePath("/mi-mercado");
	revalidatePath("/mi-mercado/[nombre]", "page");

	return { esValido: true, mensaje: "Operador eliminado correctamente." };
}
