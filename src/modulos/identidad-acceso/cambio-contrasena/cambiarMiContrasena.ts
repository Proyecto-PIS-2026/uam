"use server";

import argon2 from "argon2";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { exigirSesionEnAccion } from "../autorizacion/control-acciones";
import { habilitarCambioContrasena } from "./configuracion";
import { validarCambioContrasena } from "./validarCambioContrasena";

export async function cambiarMiContrasena(valor: unknown) {
    const sesion = await exigirSesionEnAccion();
    const deshabilitado = { esValido: false, errores: ["El cambio de contraseña no está habilitado por el administrador."] } as const;
    if (!habilitarCambioContrasena) return deshabilitado;
    const validacion = validarCambioContrasena(valor);
    if (!validacion.esValido) return validacion;

    const usuario = await db.orm.public.Usuario
        .where({ id: sesion.usuarioId, rol: sesion.rol })
        .select("passwordHash").first();
    if (!usuario) return { esValido: false as const, errores: ["No se encontró tu cuenta."] };
    if (!await argon2.verify(usuario.passwordHash, validacion.datos.actual)) {
        return { esValido: false as const, errores: ["La contraseña actual no es válida."] };
    }
    const passwordHash = await argon2.hash(validacion.datos.nueva, { type: argon2.argon2id });
    if (!habilitarCambioContrasena) return deshabilitado;
    // La comparación del hash evita sobrescribir un cambio concurrente con credenciales anteriores.
    const actualizado = await db.orm.public.Usuario
        .where({ id: sesion.usuarioId, rol: sesion.rol, passwordHash: usuario.passwordHash })
        .select("id").update({ passwordHash, solicitoRestablecimiento: false });
    if (!actualizado) return { esValido: false as const, errores: ["Las credenciales cambiaron. Volvé a ingresar tu contraseña actual."] };
    return { esValido: true as const, mensaje: "Tu contraseña se actualizó correctamente." };
}
