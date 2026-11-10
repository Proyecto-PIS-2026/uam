import { Temporal } from "@js-temporal/polyfill";
import { claveDesdeUrlImagen } from "../../infraestructura/imagenes/almacenamiento-imagenes";
import { db } from "../../infraestructura/persistencia/prisma/db";
import { ZONA_HORARIA_TAREAS, type ContextoTareaDiaria } from "../../infraestructura/tareas-programadas/tipos";
import { notificarCambioCatalogoOperador } from "../../infraestructura/tiempo-real/publicaciones";
import { enviarNotificacion } from "../notificaciones/notificaciones";
import { obtenerLimiteAntiguedadFotos, validarConfiguracionAgingFotos, type ConfiguracionAgingFotos } from "./vigencia-fotos";

async function iniciarVigenciaFotosAnteriores({ tx, limite }: ContextoTareaDiaria): Promise<void> {
    const anteriores = await tx.query(db.raw.sql`
        SELECT p.id, p.foto, i.clave
        FROM publicacion p
        JOIN imagen i ON i.clave = replace(p.foto, '/api/publicaciones/imagenes/', 'publicaciones/')
        WHERE i."cargadaEn" IS NULL
            AND p.foto LIKE '/api/publicaciones/imagenes/' || p.id::text || '/%'
    `.returnsRow({ id: "pg/int4@1", foto: "pg/text@1", clave: "pg/text@1" }).build());
    const claves = anteriores
        .filter((publicacion) => claveDesdeUrlImagen(publicacion.foto, "publicaciones", publicacion.id) === publicacion.clave)
        .map((publicacion) => publicacion.clave);
    if (claves.length === 0) return;

    await tx.execute(db.raw.sql`
        UPDATE imagen
        SET "cargadaEn" = ${limite}::timestamptz
        WHERE "cargadaEn" IS NULL
            AND clave IN (SELECT jsonb_array_elements_text(${JSON.stringify(claves)}::jsonb))
    `.affectedCount().build());
}

export async function procesarVencimientosFotos(
    contexto: ContextoTareaDiaria,
    configuracion: ConfiguracionAgingFotos,
): Promise<number> {
    const validada = validarConfiguracionAgingFotos(configuracion);
    if (!validada.habilitado) return 0;
    const { tx, limite } = contexto;
    const { diasVigencia, avisosHabilitados, diasAnticipacionAviso } = validada;
    const vencidasHasta = obtenerLimiteAntiguedadFotos(diasVigencia, limite);
    const avisarHasta = avisosHabilitados ? obtenerLimiteAntiguedadFotos(diasVigencia - diasAnticipacionAviso, limite) : vencidasHasta;
    await iniciarVigenciaFotosAnteriores(contexto);

    const propietarios = await tx.query(db.raw.sql`
        WITH propietarios AS (
            SELECT "publicacionId", "operadorId" AS "propietarioId", 1719 AS espacio
            FROM "publicacionOperador"
            UNION ALL
            SELECT "publicacionId", "productorId" AS "propietarioId", 1720 AS espacio
            FROM "publicacionProductor"
        )
        SELECT DISTINCT r.espacio, r."propietarioId"
        FROM propietarios r
        JOIN publicacion p ON p.id = r."publicacionId"
        JOIN imagen i ON i.clave = replace(p.foto, '/api/publicaciones/imagenes/', 'publicaciones/')
        WHERE p.foto LIKE '/api/publicaciones/imagenes/' || p.id::text || '/%'
            AND i."cargadaEn" <= ${avisarHasta}::timestamptz
            AND (i."cargadaEn" <= ${vencidasHasta}::timestamptz OR i."avisoVencimientoEn" IS NULL)
        ORDER BY r.espacio, r."propietarioId"
    `.returnsRow({ espacio: "pg/int4@1", propietarioId: "pg/int4@1" }).build());

    for (const propietario of propietarios) {
        await tx.execute(db.raw.sql`
            SELECT 1::int AS locked
            FROM pg_advisory_xact_lock(${propietario.espacio}, ${propietario.propietarioId})
        `.returnsRow({ locked: "pg/int4@1" }).build());
    }

    let procesadas = 0;
    for (const propietario of propietarios) {
        const publicaciones = await tx.query(db.raw.sql`
            WITH propietarios AS (
                SELECT r."publicacionId", r."operadorId" AS "propietarioId", o."usuarioId", 1719 AS espacio
                FROM "publicacionOperador" r JOIN operador o ON o.id = r."operadorId"
                UNION ALL
                SELECT r."publicacionId", r."productorId" AS "propietarioId", p."usuarioId", 1720 AS espacio
                FROM "publicacionProductor" r JOIN productor p ON p.id = r."productorId"
            )
            SELECT p.id, p.foto, i.clave, i."cargadaEn", r."usuarioId", e."nombreEspecie",
                   i."cargadaEn" <= ${vencidasHasta}::timestamptz AS vencida
            FROM propietarios r
            JOIN publicacion p ON p.id = r."publicacionId"
            JOIN especie e ON e.id = p."especieId"
            JOIN imagen i ON i.clave = replace(p.foto, '/api/publicaciones/imagenes/', 'publicaciones/')
            WHERE r.espacio = ${propietario.espacio} AND r."propietarioId" = ${propietario.propietarioId}
                AND p.foto LIKE '/api/publicaciones/imagenes/' || p.id::text || '/%'
                AND i."cargadaEn" <= ${avisarHasta}::timestamptz
                AND (i."cargadaEn" <= ${vencidasHasta}::timestamptz OR i."avisoVencimientoEn" IS NULL)
            ORDER BY p.id
            FOR UPDATE OF p, i
        `.returnsRow({
            id: "pg/int4@1", foto: "pg/text@1", clave: "pg/text@1", cargadaEn: "pg/timestamptz-temporal@1",
            usuarioId: "pg/int4@1", nombreEspecie: "pg/text@1", vencida: "pg/bool@1",
        }).build());

        let cambioCatalogo = false;
        for (const publicacion of publicaciones) {
            if (claveDesdeUrlImagen(publicacion.foto, "publicaciones", publicacion.id) !== publicacion.clave) continue;

            const referencia = publicacion.nombreEspecie.slice(0, 120);
            let texto: string;
            if (publicacion.vencida) {
                const [eliminada] = await tx.query(db.raw.sql`
                    WITH actualizada AS (
                        UPDATE publicacion
                        SET foto = NULL, "fotoEliminadaPorVencimientoEn" = ${limite}::timestamptz,
                            version = version + 1, fecha = CURRENT_TIMESTAMP
                        WHERE id = ${publicacion.id} AND foto = ${publicacion.foto}
                        RETURNING id
                    ), imagen_eliminada AS (
                        DELETE FROM imagen
                        WHERE clave = ${publicacion.clave} AND EXISTS (SELECT 1 FROM actualizada)
                        RETURNING clave
                    )
                    SELECT id FROM actualizada
                `.returnsRow({ id: "pg/int4@1" }).build());
                if (!eliminada) continue;
                texto = `La foto de tu publicación de ${referencia} venció y fue eliminada. Podés cargar una nueva foto.`;
                cambioCatalogo = true;
            } else {
                const [marcada] = await tx.query(db.raw.sql`
                    UPDATE imagen SET "avisoVencimientoEn" = ${limite}::timestamptz
                    WHERE clave = ${publicacion.clave} AND "avisoVencimientoEn" IS NULL
                    RETURNING clave
                `.returnsRow({ clave: "pg/text@1" }).build());
                if (!marcada) continue;
                const fecha = Temporal.Instant.from(publicacion.cargadaEn.toString())
                    .toZonedDateTimeISO(ZONA_HORARIA_TAREAS).add({ days: diasVigencia }).toPlainDate();
                const vencimiento = `${String(fecha.day).padStart(2, "0")}/${String(fecha.month).padStart(2, "0")}/${fecha.year}`;
                texto = `La foto de tu publicación de ${referencia} vence el ${vencimiento}. Podés reemplazarla para renovar su vigencia.`;
            }

            const { enviadas } = await enviarNotificacion({
                texto,
                url: `${propietario.espacio === 1719 ? "/mi-mercado" : "/mi-mercado/productor"}?publicacion=${publicacion.id}`,
                usuarios: [publicacion.usuarioId],
            }, tx);
            if (enviadas !== 1) throw new Error("No se pudo guardar el aviso de vencimiento para el dueño de la publicación.");
            procesadas++;
        }

        if (cambioCatalogo && propietario.espacio === 1719) {
            await notificarCambioCatalogoOperador(tx, propietario.propietarioId);
        }
    }

    return procesadas;
}
