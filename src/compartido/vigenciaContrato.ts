import { Temporal } from "@js-temporal/polyfill";
import { db } from "../infraestructura/persistencia/prisma/db";

export async function operadorTieneContratoVigente(usuarioId: number): Promise<boolean> {
    const operador = await db.orm.public.Operador
        .where({ usuarioId })
        .include("locales", (locales) => locales.select("finContrato"))
        .first();

    if (!operador) return false;

    const hoy = Temporal.Now.plainDateISO("America/Montevideo");
    return operador.locales.some((local) => {
        if (local.finContrato === null) return true;
        const fechaFin = local.finContrato
            .toZonedDateTimeISO("America/Montevideo")
            .toPlainDate();
        return Temporal.PlainDate.compare(fechaFin, hoy) >= 0;
    });
}
