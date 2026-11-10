"use server"

import { db } from "@/infraestructura/persistencia/prisma/db";
import { validarBajaAdministrador } from "./validarBajaAdministrador";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { bloquearYValidarAdministrador, esUltimoAdministradorHabilitado } from "./proteccion-administradores";

export type ResultadoBajaAdministrador =
	| { esValido: false; errores: string[] }
	| { esValido: true; mensaje: string };

export async function bajaAdministrador(valor: unknown): Promise<ResultadoBajaAdministrador> {
	const adminActual = await controlarSesionEnAccion(exigirAdministrador);

	const validacion = validarBajaAdministrador(valor);
	if (!validacion.esValido) return validacion;

	const { administradorId } = validacion.datos;

	const resultado = await db.transaction(async (tx) => {
		if (!await bloquearYValidarAdministrador(tx, adminActual.usuarioId)) {
			return { error: "Tu cuenta de administrador ya no está habilitada." };
		}

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

		if (await esUltimoAdministradorHabilitado(tx, admin.usuarioId)) {
			return { error: "No podés eliminar al último administrador habilitado." };
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
