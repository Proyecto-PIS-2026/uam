"use server"

import { db } from "@/infraestructura/persistencia/prisma/db";
import { validarBajaAdministrador } from "./validarBajaAdministrador";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";

export type ResultadoBajaAdministrador =
	| { esValido: false; errores: string[] }
	| { esValido: true; mensaje: string };

export async function bajaAdministrador(valor: unknown): Promise<ResultadoBajaAdministrador> {
	const adminActual = await exigirAdministrador();

	const validacion = validarBajaAdministrador(valor);
	if (!validacion.esValido) return validacion;

	const { administradorId } = validacion.datos;

	const resultado = await db.transaction(async (tx) => {
		await tx.execute(
			db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1721, 0)`
				.returnsRow({ locked: "pg/int4@1" })
				.build()
		);

        const actual = await tx.orm.public.Administrador.where({ usuarioId: adminActual.usuarioId }).first();
        
		if (!actual) {
			return { error: "Tu cuenta de administrador ya no existe." };
		}

		const admin = await tx.orm.public.Administrador.where({ id: administradorId }).first();
		if (!admin) {
			return { error: "El administrador seleccionado ya no existe." };
		}

        if (admin.usuarioId === adminActual.usuarioId) {
			return { error: "No podés dar de baja tu propia cuenta de administrador." };
		}

		await tx.orm.public.Administrador.where({ id: administradorId }).delete();
		await tx.orm.public.Usuario.where({ id: admin.usuarioId }).delete();

		return { error: null };
	});

	if (resultado.error) {
		return { esValido: false, errores: [resultado.error] };
	}

	revalidatePath("/administracion");
	revalidatePath("/administracion/administradores");

	return { esValido: true, mensaje: "Administrador eliminado correctamente." };
}