import { db } from "@/infraestructura/persistencia/prisma/db";
import { ZONA_HORARIA_TAREAS, type ContextoTareaDiaria } from "@/infraestructura/tareas-programadas/tipos";
import { notificarCambioCatalogoOperador, notificarCambioCatalogoProductor } from "@/infraestructura/tiempo-real/publicaciones";
import { enviarNotificacion } from "@/modulos/notificaciones/notificaciones";
import { Temporal } from "temporal-polyfill";
import type { TipoPropietarioPublicacion } from "./claves-vigencia-publicaciones";
import { obtenerConfiguracionAvisosVigencia } from "./estado-vigencia-propias";

export async function procesarVencimientosPublicaciones(
    { tx, fecha, limite }: ContextoTareaDiaria,
    tipo: TipoPropietarioPublicacion,
): Promise<number> {
    await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock_shared(1722, 0)`
        .returnsRow({ locked: "pg/int4@1" }).build());
    const configuracion = await obtenerConfiguracionAvisosVigencia(tipo, tx);
    const avisarHasta = Temporal.PlainDate.from(fecha).add({ days: configuracion.diasAnticipacion }).toString();
    const espacio = tipo === "OPERADOR" ? 1719 : 1720;
    const rutaMercado = tipo === "OPERADOR" ? "/mi-mercado" : "/mi-mercado/productor";
    const propietarios = await tx.query(db.raw.sql`
        WITH propietarios AS (
            SELECT "publicacionId", "operadorId" AS "propietarioId", 1719 AS espacio FROM "publicacionOperador"
            UNION ALL
            SELECT "publicacionId", "productorId" AS "propietarioId", 1720 AS espacio FROM "publicacionProductor"
        )
        SELECT DISTINCT r."propietarioId"
        FROM propietarios r JOIN publicacion p ON p.id = r."publicacionId"
        WHERE r.espacio = ${espacio} AND p."tipoPublicacion"::text = ${tipo}
            AND p."fechaVigencia" IS NOT NULL
            AND (
                (p."fechaVigencia" < ${limite}::timestamptz AND (p."publicacionDisponible" OR p."avisoVencimientoEn" IS NULL))
                OR (${configuracion.avisosHabilitados}::boolean AND p."fechaVigencia" >= ${limite}::timestamptz
                    AND (p."fechaVigencia" AT TIME ZONE ${ZONA_HORARIA_TAREAS})::date <= ${avisarHasta}::date
                    AND p."avisoProximoVencimientoEn" IS NULL)
            )
        ORDER BY r."propietarioId"
    `.returnsRow({ propietarioId: "pg/int4@1" }).build());

    // Comparte el orden y los bloqueos de las altas, ediciones y bajas de cada dueño.
    for (const { propietarioId } of propietarios) {
        await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(${espacio}, ${propietarioId})`
            .returnsRow({ locked: "pg/int4@1" }).build());
    }

    let procesadas = 0;
    for (const { propietarioId } of propietarios) {
        // Relee fechas y marcas después del bloqueo para respetar renovaciones y bajas concurrentes.
        const publicaciones = await tx.query(db.raw.sql`
            WITH propietarios AS (
                SELECT r."publicacionId", r."operadorId" AS "propietarioId", o."usuarioId", 1719 AS espacio
                FROM "publicacionOperador" r JOIN operador o ON o.id = r."operadorId"
                UNION ALL
                SELECT r."publicacionId", r."productorId" AS "propietarioId", p."usuarioId", 1720 AS espacio
                FROM "publicacionProductor" r JOIN productor p ON p.id = r."productorId"
            )
            SELECT p.id, p."publicacionDisponible", r."usuarioId", e."nombreEspecie",
                   to_char(p."fechaVigencia" AT TIME ZONE ${ZONA_HORARIA_TAREAS}, 'YYYY-MM-DD') AS vencimiento,
                   p."fechaVigencia" < ${limite}::timestamptz AS vencida,
                   p."avisoProximoVencimientoEn" IS NOT NULL AS "avisoProximoEnviado",
                   p."avisoVencimientoEn" IS NOT NULL AS "avisoVencidoEnviado"
            FROM propietarios r
            JOIN publicacion p ON p.id = r."publicacionId"
            JOIN especie e ON e.id = p."especieId"
            WHERE r.espacio = ${espacio} AND r."propietarioId" = ${propietarioId}
                AND p."tipoPublicacion"::text = ${tipo} AND p."fechaVigencia" IS NOT NULL
                AND (
                    (p."fechaVigencia" < ${limite}::timestamptz AND (p."publicacionDisponible" OR p."avisoVencimientoEn" IS NULL))
                    OR (${configuracion.avisosHabilitados}::boolean AND p."fechaVigencia" >= ${limite}::timestamptz
                        AND (p."fechaVigencia" AT TIME ZONE ${ZONA_HORARIA_TAREAS})::date <= ${avisarHasta}::date
                        AND p."avisoProximoVencimientoEn" IS NULL)
                )
            ORDER BY p.id
            FOR UPDATE OF p
        `.returnsRow({
            id: "pg/int4@1", publicacionDisponible: "pg/bool@1", usuarioId: "pg/int4@1", nombreEspecie: "pg/text@1",
            vencimiento: "pg/text@1", vencida: "pg/bool@1", avisoProximoEnviado: "pg/bool@1", avisoVencidoEnviado: "pg/bool@1",
        }).build());

        let cambioCatalogo = false;
        for (const publicacion of publicaciones) {
            const cambioDisponibilidad = publicacion.vencida && publicacion.publicacionDisponible;
            if (cambioDisponibilidad) {
                await tx.execute(db.raw.sql`
                    UPDATE publicacion SET "publicacionDisponible" = false WHERE id = ${publicacion.id} RETURNING id
                `.returnsRow({ id: "pg/int4@1" }).build());
                cambioCatalogo = true;
            }
            const yaAvisada = publicacion.vencida ? publicacion.avisoVencidoEnviado : publicacion.avisoProximoEnviado;
            if (yaAvisada) {
                if (cambioDisponibilidad) procesadas++;
                continue;
            }
            const texto = publicacion.vencida
                ? `Tu publicación de ${publicacion.nombreEspecie} ha vencido el ${publicacion.vencimiento} y ya no está disponible.`
                : `Tu publicación de ${publicacion.nombreEspecie} está próxima a vencer el ${publicacion.vencimiento}.`;
            const { enviadas } = await enviarNotificacion({
                texto, usuarios: [publicacion.usuarioId], url: `${rutaMercado}?publicacion=${publicacion.id}`,
            }, tx);
            if (enviadas !== 1) throw new Error("No se pudo guardar el aviso de vigencia para el dueño de la publicación.");
            const marcar = publicacion.vencida
                ? db.raw.sql`UPDATE publicacion SET "avisoVencimientoEn" = ${limite}::timestamptz WHERE id = ${publicacion.id} RETURNING id`
                : db.raw.sql`UPDATE publicacion SET "avisoProximoVencimientoEn" = ${limite}::timestamptz WHERE id = ${publicacion.id} RETURNING id`;
            await tx.execute(marcar.returnsRow({ id: "pg/int4@1" }).build());
            procesadas++;
        }
        if (cambioCatalogo) {
            if (tipo === "OPERADOR") await notificarCambioCatalogoOperador(tx, propietarioId);
            else await notificarCambioCatalogoProductor(tx, propietarioId);
        }
    }
    return procesadas;
}
