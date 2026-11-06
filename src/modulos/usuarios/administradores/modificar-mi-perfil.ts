"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";

type DatosMiPerfil = { nombre: string; correo: string };
type Resultado = { esValido: true; mensaje: string } | { esValido: false; errores: string[] };

function validarDatos(valor: unknown): { esValido: true; datos: DatosMiPerfil } | { esValido: false; errores: string[] } {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
        return { esValido: false, errores: ["Los datos del perfil no son válidos."] };
    }
    const entrada = valor as Record<string, unknown>;
    const nombre = typeof entrada.nombre === "string" ? entrada.nombre.trim() : "";
    const correo = typeof entrada.correo === "string" ? entrada.correo.trim() : "";
    const errores: string[] = [];
    if (nombre.length < 3) errores.push("El nombre de usuario debe tener al menos 3 caracteres.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.push("El correo electrónico no es válido.");
    return errores.length > 0 ? { esValido: false, errores } : { esValido: true, datos: { nombre, correo } };
}

/** Edición propia: no se acepta usuarioId/administradorId/rol del cliente. */
export async function modificarMiPerfilAdministrador(valor: unknown): Promise<Resultado> {
    const sesion = await controlarSesionEnAccion(exigirAdministrador);
    const validacion = validarDatos(valor);
    if (!validacion.esValido) return validacion;

    const { nombre, correo } = validacion.datos;
    try {
        const resultado = await db.transaction(async (tx) => {
            const administrador = await tx.orm.public.Administrador
                .select("id")
                .where({ usuarioId: sesion.usuarioId })
                .first();
            if (!administrador) return "No se pudo encontrar tu perfil.";

            const correoExistente = await tx.orm.public.Administrador.where({ email: correo }).select("id").first();
            if (correoExistente && correoExistente.id !== administrador.id) {
                return "Ya existe un administrador con ese correo electrónico.";
            }
            const nombreExistente = await tx.orm.public.Usuario.where({ username: nombre }).select("id").first();
            if (nombreExistente && nombreExistente.id !== sesion.usuarioId) {
                return "Ya existe un usuario con ese nombre.";
            }

            await tx.orm.public.Administrador.where({ id: administrador.id }).update({ email: correo });
            await tx.orm.public.Usuario.where({ id: sesion.usuarioId }).update({ username: nombre });
            return null;
        });
        if (resultado) return { esValido: false, errores: [resultado] };
    } catch {
        // Incluye fallos de persistencia y carreras de unicidad; nunca informar éxito.
        return { esValido: false, errores: ["No se pudieron guardar los cambios. Intentá nuevamente."] };
    }

    revalidatePath("/mi-perfil");
    revalidatePath("/administracion");
    return { esValido: true, mensaje: "Perfil actualizado correctamente." };
}
