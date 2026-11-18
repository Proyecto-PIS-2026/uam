"use server"

import { guardarUsuarioAtomico } from "../../guardar-usuario-atomico";
import { validarAltaAdministrador } from "../validaciones/validar-alta-administrador";
import argon2 from "argon2";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";

export type ResultadoAltaAdministrador =
	| { esValido: false; errores: string[] }
	| { esValido: true; id: number; mensaje: string };

export async function altaAdministrador(valor: unknown): Promise<ResultadoAltaAdministrador> {
	await controlarSesionEnAccion(exigirAdministrador);

	const validacion = validarAltaAdministrador(valor);
	if (!validacion.esValido) return validacion;

	const datos = validacion.datos;

	const passwordHash = await argon2.hash(datos.contraseña, { type: argon2.argon2id });

    const resultadoTx = await guardarUsuarioAtomico(async (tx) => {

        const existente = await tx.orm.public.Usuario.where({ username: datos.nombreUsuario }).first();
        if (existente) return "Ya existe un usuario con ese nombre de usuario.";

        const emailExistente = await tx.orm.public.Administrador.where({ email: datos.email }).first();
        if (emailExistente) return "Ya existe un administrador con ese email.";

        // El correo administrativo y el username de operadores/productores comparten el campo de inicio de sesión.
        const usuarioConEseIdentificador = await tx.orm.public.Usuario.where({ username: datos.email }).first();
        if (usuarioConEseIdentificador && usuarioConEseIdentificador.rol !== "ADMINISTRADOR") {
            return "El email coincide con el nombre de usuario de un operador o productor. Elegí otro email.";
        }

        const usuario = await tx.orm.public.Usuario.create({
            username: datos.nombreUsuario,
            passwordHash,
            rol: "ADMINISTRADOR",
        });

        const administrador = await tx.orm.public.Administrador.create({
            usuarioId: usuario.id,
            email: datos.email,
        });

        return administrador.id;
        
    }, "administrador");

	if (typeof resultadoTx === "string") {
	    return { esValido: false, errores: [resultadoTx] };
    }

    revalidatePath("/administracion");

    return { esValido: true, id: resultadoTx, mensaje: "Administrador creado correctamente." };
}
