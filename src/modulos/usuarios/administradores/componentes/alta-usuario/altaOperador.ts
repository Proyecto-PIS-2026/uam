"use server"

import { db } from "@/infraestructura/persistencia/prisma/db";
import { validarAltaOperador } from "./validarAltaOperador";
import argon2 from "argon2";

export type ResultadoAltaOperador =
	| { esValido: false; errores: string[] }
	| { esValido: true; id: number; mensaje: string };

export async function altaOperador(valor: unknown): Promise<ResultadoAltaOperador> {
	const validacion = validarAltaOperador(valor);
	if (!validacion.esValido) return validacion;

	const datos = validacion.datos;

	const idsNaves = [...new Set(datos.locales.map((local) => local.naveId))];
	const naves = await Promise.all(idsNaves.map((id) => db.orm.public.Nave.where({ id }).first()));
	if (naves.some((nave) => !nave)) {
		return { esValido: false, errores: ["Alguna de las naves seleccionadas ya no está disponible. Actualizá el formulario."] };
	}

	const passwordHash = await argon2.hash(datos.contraseña, { type: argon2.argon2id });
	const resultadoTx  = await db.transaction(async (tx) => {
		// Serializar altas con el mismo nombre de usuario para que dos envíos
		// simultáneos no pasen ambos la comprobación antes de insertar.
		await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1720, hashtext(${datos.nombreUsuario}))`
			.returnsRow({ locked: "pg/int4@1" }).build());

		const existente = await tx.orm.public.Usuario.where({ username: datos.nombreUsuario }).first();
        if (existente) return "Ya existe un usuario con ese nombre de usuario.";

        const nombreRepetido = await tx.orm.public.Operador.where({ nombreFantasia: datos.nombre }).first();
        if (nombreRepetido) return "Ya existe un operador con ese nombre.";

        for (const local of datos.locales) {
            const localExistente = await tx.orm.public.Local.where({
                naveId: local.naveId,
                numeroLocal: local.nombre,
            }).first();
            if (localExistente) {
                return `El local ${local.nombre} ya existe en la nave seleccionada.`;
            }
        }

		const usuario = await tx.orm.public.Usuario.create({
			username: datos.nombreUsuario,
			passwordHash,
			rol: "OPERADOR",
		});
		const operador = await tx.orm.public.Operador.create({
			usuarioId: usuario.id,
			nombreFantasia: datos.nombre,
			whatsApp: datos.telefono,
		});
		for (const local of datos.locales) {
			await tx.orm.public.Local.create({
            operadorId: operador.id,
            naveId: local.naveId,
            numeroLocal: local.nombre,
            finContrato: local.contrato
                ? Temporal.PlainDate.from(local.contrato)
                    .toPlainDateTime({ hour: 23, minute: 59, second: 59 })
                    .toZonedDateTime("UTC")
                    .toInstant()
                : null,
	    });
		}
		return operador.id;
	});

	if (typeof resultadoTx === "string") {
	    return { esValido: false, errores: [resultadoTx] };
    }

    return { esValido: true, id: resultadoTx, mensaje: "Operador creado correctamente." };
}