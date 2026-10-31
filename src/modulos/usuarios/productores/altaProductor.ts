"use server"

import { guardarUsuarioAtomico } from "../guardar-usuario-atomico";
import { validarAltaProductor } from "./validarAltaProductor";
import argon2 from "argon2";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { controlarErrorFotoPerfil, guardarCambioFotoPerfil, validarCambioFotoPerfil } from "../fotos-perfil";

export type ResultadoAltaProductor =
	| { esValido: false; errores: string[] }
	| { esValido: true; id: number; mensaje: string };

export async function altaProductor(valor: unknown, foto?: FormData): Promise<ResultadoAltaProductor> {
	await controlarSesionEnAccion(exigirAdministrador);

	const validacion = validarAltaProductor(valor);
	if (!validacion.esValido) return validacion;
	const validacionFoto = validarCambioFotoPerfil(foto, false);
	if (!validacionFoto.esValido) return validacionFoto;

	const datos = validacion.datos;

	const passwordHash = await argon2.hash(datos.contraseña, { type: argon2.argon2id });
	const resultadoTx = await controlarErrorFotoPerfil(() => guardarUsuarioAtomico(async (tx) => {
		const existente = await tx.orm.public.Usuario.where({ username: datos.nombreUsuario }).first();
		if (existente) return "Ya existe un usuario con ese nombre de usuario.";

		const nombreRepetido = await tx.orm.public.Productor.where({ nombreFantasia: datos.nombre }).first();
		if (nombreRepetido) return "Ya existe un productor con ese nombre.";

		const usuario = await tx.orm.public.Usuario.create({
			username: datos.nombreUsuario,
			passwordHash,
			rol: "PRODUCTOR",
		});
		const productor = await tx.orm.public.Productor.create({
			usuarioId: usuario.id,
			nombreFantasia: datos.nombre,
			whatsApp: datos.telefono,
		});
		const fotoPerfil = await guardarCambioFotoPerfil(tx, "productores", productor.id, null, validacionFoto.cambio);
		if (fotoPerfil !== undefined) await tx.orm.public.Productor.where({ id: productor.id }).update({ fotoPerfil });
		return productor.id;
	}, "productor"));

	if (typeof resultadoTx === "string") {
		return { esValido: false, errores: [resultadoTx] };
	}

	revalidatePath("/administracion");
	revalidatePath("/productores");

	return { esValido: true, id: resultadoTx, mensaje: "Productor creado correctamente." };
}
