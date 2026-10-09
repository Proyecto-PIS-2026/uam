"use server";

import { db } from "@/infraestructura/persistencia/prisma/db";
import argon2 from "argon2";
import { validarModificacionOperador } from "./validarModificacionOperador";

export type ResultadoModificacionOperador =
    | { esValido: false; errores: string[] }
    | { esValido: true; id: number; mensaje: string };

export async function modificarOperador(
    valor: unknown,
): Promise<ResultadoModificacionOperador> {
    // TODO(BP-04.4): verificar que el usuario autenticado
    // sea ADMINISTRADOR antes de permitir la modificación.

    const validacion = validarModificacionOperador(valor);

    if (!validacion.esValido) {
        return validacion;
    }

    const datos = validacion.datos;

    const idsNaves = [
        ...new Set(datos.locales.map((local) => local.naveId)),
    ];

    const naves = await Promise.all(
        idsNaves.map((id) =>
            db.orm.public.Nave.where({ id }).first(),
        ),
    );

    if (naves.some((nave) => !nave)) {
        return {
            esValido: false,
            errores: [
                "Alguna de las naves seleccionadas ya no está disponible. Actualizá el formulario.",
            ],
        };
    }

    const passwordHash = datos.contraseña
        ? await argon2.hash(datos.contraseña, {
              type: argon2.argon2id,
          })
        : null;

    const resultadoTx = await db.transaction(async (tx) => {
        const operador = await tx.orm.public.Operador
            .select("id", "usuarioId")
            .where({ id: datos.operadorId })
            .first();

        if (!operador) {
            return "El operador ya no existe.";
        }

        const nombreRepetido =
            await tx.orm.public.Operador
                .where({
                    nombreFantasia: datos.nombre,
                })
                .first();

        if (
            nombreRepetido &&
            nombreRepetido.id !== datos.operadorId
        ) {
            return "Ya existe un operador con ese nombre.";
        }

        /*
         * Comprobamos que ninguno de los locales elegidos
         * pertenezca a otro Operador.
         */
        for (const local of datos.locales) {
            const localExistente =
                await tx.orm.public.Local
                    .where({
                        naveId: local.naveId,
                        numeroLocal: local.nombre,
                    })
                    .first();

            if (
                localExistente &&
                localExistente.operadorId !==
                    datos.operadorId
            ) {
                return `El local ${local.nombre} ya existe en la nave seleccionada.`;
            }
        }

        await tx.orm.public.Operador
            .where({ id: datos.operadorId })
            .update({
                nombreFantasia: datos.nombre,
                whatsApp: datos.telefono,
            });

        if (passwordHash) {
            await tx.orm.public.Usuario
                .where({ id: operador.usuarioId })
                .update({
                    passwordHash,
                });
        }

        /*
         * Obtenemos TODOS los locales actuales y los
         * eliminamos individualmente por ID.
         *
         * No usamos un delete() directamente sobre
         * where({ operadorId }) porque necesitamos
         * garantizar que desaparezcan todos antes de
         * volver a crearlos.
         */
        const localesActuales =
            await tx.orm.public.Local
                .select("id")
                .where({
                    operadorId: datos.operadorId,
                })
                .all();

        for (const localActual of localesActuales) {
            await tx.orm.public.Local
                .where({
                    id: localActual.id,
                })
                .delete();
        }

        /*
         * Recreamos los locales con los datos nuevos.
         */
        for (const local of datos.locales) {
            await tx.orm.public.Local.create({
                operadorId: datos.operadorId,
                naveId: local.naveId,
                numeroLocal: local.nombre,
                finContrato: local.contrato
                    ? Temporal.PlainDate.from(
                          local.contrato,
                      )
                          .toPlainDateTime({
                              hour: 23,
                              minute: 59,
                              second: 59,
                          })
                          .toZonedDateTime("UTC")
                          .toInstant()
                    : null,
            });
        }

        return datos.operadorId;
    });

    if (typeof resultadoTx === "string") {
        return {
            esValido: false,
            errores: [resultadoTx],
        };
    }

    return {
        esValido: true,
        id: resultadoTx,
        mensaje: "Operador modificado correctamente.",
    };
}