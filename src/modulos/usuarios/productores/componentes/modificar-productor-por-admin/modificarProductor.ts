"use server";

import { db } from "@/infraestructura/persistencia/prisma/db";
import argon2 from "argon2";
import { validarModificacionProductor } from "./validarModificacionProductor";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { guardarUsuarioAtomico } from "@/modulos/usuarios/guardar-usuario-atomico";
import { controlarErrorFotoPerfil, guardarCambioFotoPerfil, validarCambioFotoPerfil } from "@/modulos/usuarios/fotos-perfil";

export type ResultadoModificacionProductor =
    | { esValido: false; errores: string[] }
    | { esValido: true; id: number; mensaje: string };

export async function modificarProductor(
    valor: unknown,
    foto?: FormData,
): Promise<ResultadoModificacionProductor> {
    await controlarSesionEnAccion(exigirAdministrador);

    const validacion = validarModificacionProductor(valor);

    if (!validacion.esValido) {
        return validacion;
    }
    const validacionFoto = validarCambioFotoPerfil(foto);
    if (!validacionFoto.esValido) return validacionFoto;

    const datos = validacion.datos;

    const passwordHash = datos.contraseña
        ? await argon2.hash(datos.contraseña, {
              type: argon2.argon2id,
          })
        : null;

    const resultadoTx = await controlarErrorFotoPerfil(() => guardarUsuarioAtomico(async (tx) => {
        await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1720, ${datos.productorId})`
            .returnsRow({ locked: "pg/int4@1" }).build());
        const productor = await tx.orm.public.Productor
            .select("id", "usuarioId", "fotoPerfil")
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

        const fotoPerfil = await guardarCambioFotoPerfil(tx, "productores", datos.productorId, productor.fotoPerfil ?? null, validacionFoto.cambio);

        await tx.orm.public.Productor
            .where({ id: datos.productorId })
            .update({
                nombreFantasia: datos.nombre,
                whatsApp: datos.telefono,
                ...(fotoPerfil !== undefined ? { fotoPerfil } : {}),
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
    }, "productor"));

    if (typeof resultadoTx === "string") {
        return {
            esValido: false,
            errores: [resultadoTx],
        };
    }

    revalidatePath("/administracion");
    revalidatePath("/gestion-productores/[id]", "page");
    revalidatePath("/gestion-productores/[id]/editar", "page");
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
