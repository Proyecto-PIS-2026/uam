"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";

export type ResultadoRestablecimientoSegundoFactor =
    | { esValido: false; errores: string[] }
    | { esValido: true; mensaje: string };

export async function restablecerSegundoFactorAdministrador(administradorId: number): Promise<ResultadoRestablecimientoSegundoFactor> {
    const sesion = await exigirAdministrador();
    if (!Number.isSafeInteger(administradorId) || administradorId <= 0 || administradorId > 2147483647) {
        return { esValido: false, errores: ["El administrador seleccionado no es válido."] };
    }

    const error = await db.transaction(async (tx) => {
        const administrador = await tx.orm.public.Administrador.where({ id: administradorId }).first();
        if (!administrador) return "El administrador ya no existe.";
        if (administrador.usuarioId === sesion.usuarioId) return "No podés restablecer tu propio segundo factor.";

        await tx.execute(db.raw.sql`SELECT id FROM usuario WHERE id = ${administrador.usuarioId} FOR UPDATE`
            .returnsRow({ id: "pg/int4@1" }).build());
        const usuario = await tx.orm.public.Usuario.where({ id: administrador.usuarioId, rol: "ADMINISTRADOR" }).first();
        if (!usuario) return "El administrador ya no existe.";

        await tx.orm.public.Usuario.where({ id: usuario.id }).update({
            twoFactorEnabled: false,
            twoFactorSecret: null,
            twoFactorPendingSecret: null,
            twoFactorChallengeHash: null,
            twoFactorExpiresAt: null,
            twoFactorLastStep: null,
            twoFactorFailedAttempts: 0,
            twoFactorLockedUntil: null,
        });
        return null;
    });

    if (error) return { esValido: false, errores: [error] };
    revalidatePath(`/gestion-administradores/${administradorId}`);
    revalidatePath("/administracion");
    return { esValido: true, mensaje: "Segundo factor restablecido. El administrador deberá vincular su aplicación al iniciar sesión." };
}
