"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { notificarCambioCatalogoOperador } from "@/infraestructura/tiempo-real/publicaciones";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";

export type ResultadoHabilitacionUsuario =
    | { esValido: false; errores: string[] }
    | { esValido: true; mensaje: string };

export async function cambiarHabilitacionUsuario(valor: unknown): Promise<ResultadoHabilitacionUsuario> {
    const sesion = await controlarSesionEnAccion(exigirAdministrador);

    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
        return { esValido: false, errores: ["Los datos del usuario no son válidos."] };
    }
    const { usuarioId, habilitado } = valor as Record<string, unknown>;
    if (typeof usuarioId !== "number" || !Number.isSafeInteger(usuarioId) || usuarioId <= 0 || usuarioId > 2147483647 || typeof habilitado !== "boolean") {
        return { esValido: false, errores: ["El usuario o el estado seleccionado no son válidos."] };
    }
    if (usuarioId === sesion.usuarioId && !habilitado) {
        return { esValido: false, errores: ["No podés deshabilitarte a vos mismo."] };
    }

    const actualizado = await db.transaction(async (tx) => {
        const usuario = await tx.orm.public.Usuario.where({ id: usuarioId })
            .select("id", "rol").update({ habilitado });
        if (!usuario) return false;

        if (usuario.rol === "OPERADOR") {
            const operador = await tx.orm.public.Operador.select("id").where({ usuarioId }).first();
            if (operador) await notificarCambioCatalogoOperador(tx, operador.id);
        }
        return true;
    });

    if (!actualizado) {
        return { esValido: false, errores: ["El usuario seleccionado ya no existe."] };
    }

    revalidatePath("/administracion");
    revalidatePath("/inicio");
    revalidatePath("/publicaciones");
    revalidatePath("/operadores");
    revalidatePath("/operadores/[nombre]", "page");
    revalidatePath("/productores");
    revalidatePath("/productores/[nombre]", "page");

    return { esValido: true, mensaje: `Usuario ${habilitado ? "habilitado" : "deshabilitado"} correctamente.` };
}
