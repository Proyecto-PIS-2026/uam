"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { validarModificacionAdministrador } from "../componentes/modificar-administrador/validarModificacionAdministrador";
import type { ResultadoModificacionAdministrador } from "../componentes/modificar-administrador/modificarAdministrador";

export async function modificarMiPerfilAdministrador(valor: unknown): Promise<ResultadoModificacionAdministrador> {
    const sesion = await controlarSesionEnAccion(exigirAdministrador);

    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
        return { esValido: false, errores: ["Los datos del administrador no son válidos."] };
    }

    const entrada = valor as Record<string, unknown>;

    const resultado = await db.transaction(async (tx) => {
        const administrador = await tx.orm.public.Administrador
            .select("id", "usuarioId")
            .where({ usuarioId: sesion.usuarioId })
            .first();

        if (!administrador) {
            return ["No se encontró tu perfil de administrador."];
        }

        const validacion = validarModificacionAdministrador({
            administradorId: administrador.id,
            nombreUsuario: entrada.nombreUsuario,
        });

        if (!validacion.esValido) {
            return validacion.errores;
        }

        const datos = validacion.datos;

        const nombreRepetido = await tx.orm.public.Usuario
            .where({ username: datos.nombreUsuario })
            .first();

        if (nombreRepetido && nombreRepetido.id !== administrador.usuarioId) {
            return ["Ya existe un usuario con ese nombre."];
        }

        await tx.orm.public.Usuario
            .where({ id: administrador.usuarioId })
            .update({ username: datos.nombreUsuario });

        return administrador.id;
    });

    if (Array.isArray(resultado)) {
        return { esValido: false, errores: resultado };
    }

    revalidatePath("/", "layout");

    return {
        esValido: true,
        id: resultado,
        mensaje: "Tu perfil se actualizó correctamente.",
    };
}
