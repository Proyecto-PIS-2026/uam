"use server";

import { db } from "@/infraestructura/persistencia/prisma/db";
import argon2 from "argon2";
import { validarModificacionProductor } from "./validarModificacionProductor";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { guardarUsuarioAtomico } from "@/modulos/usuarios/guardar-usuario-atomico";

export type ResultadoModificacionProductor =
    | { esValido: false; errores: string[] }
    | { esValido: true; id: number; mensaje: string };

export async function modificarProductor(
    valor: unknown,
): Promise<ResultadoModificacionProductor> {
    await exigirAdministrador();

    const validacion = validarModificacionProductor(valor);

    if (!validacion.esValido) {
        return validacion;
    }

    const datos = validacion.datos;

    const passwordHash = datos.contraseña
        ? await argon2.hash(datos.contraseña, {
              type: argon2.argon2id,
          })
        : null;

    const resultadoTx = await guardarUsuarioAtomico(async (tx) => {
        await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1720, ${datos.productorId})`
            .returnsRow({ locked: "pg/int4@1" }).build());
        const productor = await tx.orm.public.Productor
            .select("id", "usuarioId")
            .where({ id: datos.productorId })
            .first();

        if (!productor) {
            return "El productor ya no existe.";
        }

        const nombreRepetido =
            await tx.orm.public.Productor
                .where({
                    nombreFantasia: datos.nombre,
                })
                .first();

        if (
            nombreRepetido &&
            nombreRepetido.id !== datos.productorId
        ) {
            return "Ya existe un productor con ese nombre.";
        }

        await tx.orm.public.Productor
            .where({ id: datos.productorId })
            .update({
                nombreFantasia: datos.nombre,
                whatsApp: datos.telefono,
            });

        if (passwordHash) {
            await tx.orm.public.Usuario
                .where({ id: productor.usuarioId })
                .update({
                    passwordHash,
                    solicitoRestablecimiento: false,
                });
        }

        return datos.productorId;
    }, "productor");

    if (typeof resultadoTx === "string") {
        return {
            esValido: false,
            errores: [resultadoTx],
        };
    }

    revalidatePath("/administracion");
    revalidatePath("/gestion-productores/[id]", "page");
    revalidatePath("/publicaciones-productor");
    revalidatePath("/productores");
    revalidatePath("/productores/[nombre]", "page");
    revalidatePath("/mi-mercado/productor");

    return {
        esValido: true,
        id: resultadoTx,
        mensaje: "Productor modificado correctamente.",
    };
}
