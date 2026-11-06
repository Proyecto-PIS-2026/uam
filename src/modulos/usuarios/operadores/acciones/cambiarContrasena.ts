"use server";

import argon2 from "argon2";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { exigirOperador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { estaHabilitadoCambioContrasena } from "@/modulos/identidad-acceso/cambio-contrasena/configuracion";
import {
    validarCambioContrasena,
    type ResultadoValidacionCambioContrasena,
} from "../validaciones/validarCambioContrasena";

export type EstadoCambioContrasena = {
    error?: string;
    exito?: string;
};

export async function cambiarContrasena(
    _estadoAnterior: EstadoCambioContrasena,
    formulario: FormData,
): Promise<EstadoCambioContrasena> {
    const sesion = await controlarSesionEnAccion(exigirOperador);
    if (!await estaHabilitadoCambioContrasena()) {
        return { error: "El cambio de contraseña no está habilitado por el administrador." };
    }
    const validacion: ResultadoValidacionCambioContrasena =
        validarCambioContrasena({
            contrasenaActual: formulario.get("contrasenaActual"),
            nuevaContrasena: formulario.get("nuevaContrasena"),
            confirmacionContrasena: formulario.get("confirmacionContrasena"),
        });

    if (!validacion.esValido) {
        return { error: validacion.errores.join(" ") };
    }

    const usuario = await db.orm.public.Usuario
        .select("id", "passwordHash")
        .where({ id: sesion.usuarioId, rol: "OPERADOR" })
        .first();

    if (!usuario) {
        return { error: "No se pudo encontrar tu usuario. Intentá nuevamente." };
    }

    try {
        const contrasenaActualValida = await argon2.verify(
            usuario.passwordHash,
            validacion.datos.contrasenaActual,
        );

        if (!contrasenaActualValida) {
            return { error: "La contraseña actual no es correcta." };
        }

        if (validacion.datos.contrasenaActual === validacion.datos.nuevaContrasena) {
            return { error: "La nueva contraseña debe ser diferente de la actual." };
        }

        const passwordHash = await argon2.hash(
            validacion.datos.nuevaContrasena,
            { type: argon2.argon2id },
        );

        await db.orm.public.Usuario
            .where({ id: usuario.id })
            .update({ passwordHash, solicitoRestablecimiento: false });

        return { exito: "Contraseña cambiada correctamente." };
    } catch (error) {
        console.error("Error al cambiar la contraseña del operador:", error);
        return {
            error: "No se pudo cambiar la contraseña. Intentá nuevamente.",
        };
    }
}
