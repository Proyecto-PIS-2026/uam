import { Temporal } from "@js-temporal/polyfill";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { ZONA_HORARIA_TAREAS, type ContextoTareaDiaria } from "@/infraestructura/tareas-programadas/tipos";
import { enviarNotificacion } from "@/modulos/notificaciones/notificaciones";
import type { ConfiguracionAvisosLocales } from "./configuracion-avisos-locales";

export async function procesarVencimientosLocales(
    { tx, fecha }: ContextoTareaDiaria,
    configuracion: ConfiguracionAvisosLocales,
): Promise<number> {
    if (!configuracion.habilitado) return 0;
    const { diasAnticipacionAviso } = configuracion;
    if (!Number.isSafeInteger(diasAnticipacionAviso) || diasAnticipacionAviso < 0 || diasAnticipacionAviso > 365) {
        throw new Error("La anticipación de los avisos de locales debe ser un entero entre 0 y 365 días.");
    }
    const avisarHasta = Temporal.PlainDate.from(fecha).add({ days: diasAnticipacionAviso }).toString();
    const operadores = await tx.query(db.raw.sql`
        SELECT DISTINCT "operadorId"
        FROM local
        WHERE ("finContrato" AT TIME ZONE ${ZONA_HORARIA_TAREAS})::date <= ${avisarHasta}::date
        ORDER BY "operadorId"
    `.returnsRow({ operadorId: "pg/int4@1" }).build());

    let procesados = 0;
    for (const { operadorId } of operadores) {
        // Comparte el bloqueo de edición/baja del operador para leer sus locales completos.
        await tx.execute(db.raw.sql`
            SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ${operadorId})
        `.returnsRow({ locked: "pg/int4@1" }).build());
        const locales = await tx.query(db.raw.sql`
            SELECT l.id, l."naveId", l."numeroLocal", l."finContrato", o."nombreFantasia", n."nombreNave",
                   to_char(l."finContrato" AT TIME ZONE ${ZONA_HORARIA_TAREAS}, 'DD/MM/YYYY') AS vencimiento,
                   (l."finContrato" AT TIME ZONE ${ZONA_HORARIA_TAREAS})::date < ${fecha}::date AS vencido
            FROM local l
            JOIN operador o ON o.id = l."operadorId"
            JOIN nave n ON n.id = l."naveId"
            WHERE l."operadorId" = ${operadorId}
                AND (l."finContrato" AT TIME ZONE ${ZONA_HORARIA_TAREAS})::date <= ${avisarHasta}::date
            ORDER BY l.id
            FOR UPDATE OF l
        `.returnsRow({
            id: "pg/int4@1", naveId: "pg/int4@1", numeroLocal: "pg/text@1", finContrato: "pg/timestamptz-temporal@1",
            nombreFantasia: "pg/text@1", nombreNave: "pg/text@1", vencimiento: "pg/text@1", vencido: "pg/bool@1",
        }).build());

        for (const local of locales) {
            const tipo = local.vencido ? "vencido" : "proximo";
            // Identifica el contrato por su día en Uruguay, sin depender del ID del local ni de su hora.
            const [aviso] = await tx.query(db.raw.sql`
                INSERT INTO "avisoVencimientoLocal" ("operadorId", "naveId", "numeroLocal", "finContrato", tipo)
                VALUES (${operadorId}, ${local.naveId}, ${local.numeroLocal},
                    (${local.finContrato.toString()}::timestamptz AT TIME ZONE ${ZONA_HORARIA_TAREAS})::date, ${tipo})
                ON CONFLICT ("operadorId", "naveId", "numeroLocal", "finContrato", tipo) DO NOTHING
                RETURNING id
            `.returnsRow({ id: "pg/int4@1" }).build());
            if (!aviso) continue;

            const referencia = `El contrato del local ${local.numeroLocal.slice(0, 120)} de la nave ${local.nombreNave.slice(0, 120)}, del operador ${local.nombreFantasia.slice(0, 160)}`;
            const { enviadas } = await enviarNotificacion({
                texto: `${referencia} ${local.vencido ? "venció" : "vence"} el ${local.vencimiento}.`,
                url: `/gestion-operadores/${operadorId}`,
                roles: ["ADMINISTRADOR"],
            }, tx);
            if (enviadas === 0) {
                // Si aún no hay administradores, permitir que el siguiente recorrido vuelva a intentar.
                await tx.orm.public.AvisoVencimientoLocal.where({ id: aviso.id }).delete();
                continue;
            }
            procesados++;
        }
    }
    return procesados;
}
