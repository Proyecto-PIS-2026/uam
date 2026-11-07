"use server";

import { db } from "@/infraestructura/persistencia/prisma/db";
import argon2 from "argon2";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { validarModificacionAdministrador } from "./validarModificacionAdministrador";

export type ResultadoModificacionAdministrador =
    | { esValido: false; errores: string[] }
    | { esValido: true; id: number; mensaje: string };

export async function modificarAdministrador(valor: unknown): Promise<ResultadoModificacionAdministrador> {
    const sesion = await controlarSesionEnAccion(exigirAdministrador);

    const validacion = validarModificacionAdministrador(valor);

    if (!validacion.esValido) {
        return validacion;
    }

    const datos = validacion.datos;

    const passwordHash = datos.contraseña
        ? await argon2.hash(datos.contraseña, { type: argon2.argon2id })
        : null;

    const resultadoTx = await db.transaction(async (tx) => {
        const administrador = await tx.orm.public.Administrador
            .select("id", "usuarioId")
            .where({ id: datos.administradorId })
            .first();

        if (!administrador) {
            return "El administrador ya no existe.";
        }

        if (administrador.usuarioId === sesion.usuarioId) {
            return "Tus propios datos se modifican desde Mi perfil.";
        }

        const correoRepetido = await tx.orm.public.Administrador
            .where({ email: datos.email })
            .first();

        if (correoRepetido && correoRepetido.id !== datos.administradorId) {
            return "Ya existe un administrador con ese correo electrónico.";
        }

        const nombreRepetido = await tx.orm.public.Usuario
            .where({ username: datos.nombreUsuario })
            .first();

        if (nombreRepetido && nombreRepetido.id !== administrador.usuarioId) {
            return "Ya existe un usuario con ese nombre.";
        }

        await tx.orm.public.Administrador
            .where({ id: datos.administradorId })
            .update({ email: datos.email });

        await tx.orm.public.Usuario
            .where({ id: administrador.usuarioId })
            .update(passwordHash ? { username: datos.nombreUsuario, passwordHash, solicitoRestablecimiento: false } : { username: datos.nombreUsuario });

        return datos.administradorId;
    });

    if (typeof resultadoTx === "string") {
        return { esValido: false, errores: [resultadoTx] };
    }

    revalidatePath("/administracion");
    revalidatePath("/gestion-administradores/[id]", "page");

    return {
        esValido: true,
        id: resultadoTx,
        mensaje: "Administrador modificado correctamente.",
    };
}
