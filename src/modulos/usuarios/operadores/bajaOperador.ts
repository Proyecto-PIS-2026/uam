"use server"

import { db } from "@/infraestructura/persistencia/prisma/db";
import { validarBajaOperador } from "./validarBajaOperador";

export type ResultadoBajaOperador =
	| { esValido: false; errores: string[] }
	| { esValido: true; mensaje: string };

export async function bajaOperador(valor: unknown): Promise<ResultadoBajaOperador> {
    const validacion = validarBajaOperador(valor);
	if (!validacion.esValido) return validacion;

    const { operadorId } = validacion.datos;

    const error = await db.transaction(async (tx) => {
		const operador = await tx.orm.public.Operador.where({ id: operadorId }).first();
		if (!operador) return "El operador seleccionado ya no existe.";

		const relaciones = await tx.orm.public.PublicacionOperador.where({ operadorId }).all();
		await tx.orm.public.PublicacionOperador.where({ operadorId }).delete();
		for (const relacion of relaciones) {
			await tx.orm.public.Publicacion.where({ id: relacion.publicacionId }).delete();
		}

		await tx.orm.public.Local.where({ operadorId }).delete();
		await tx.orm.public.Operador.where({ id: operadorId }).delete();
		await tx.orm.public.Usuario.where({ id: operador.usuarioId }).delete();
		return null;
	});

	if (error) {
		return { esValido: false, errores: [error] };
	}

	return { esValido: true, mensaje: "Operador eliminado correctamente." };
}