import { claveDesdeUrlImagen } from "../../infraestructura/imagenes/almacenamiento-imagenes";
import { db } from "../../infraestructura/persistencia/prisma/db";
import type { ContextoTareaDiaria } from "../../infraestructura/tareas-programadas/tipos";
import { notificarCambioCatalogoOperador } from "../../infraestructura/tiempo-real/publicaciones";
import { obtenerLimiteAntiguedadFotos } from "./vigencia-fotos";

async function iniciarVigenciaFotosAnteriores(tx: ContextoTareaDiaria["tx"]): Promise<void> {
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
        SET "cargadaEn" = CURRENT_TIMESTAMP
        WHERE "cargadaEn" IS NULL
            AND clave IN (SELECT jsonb_array_elements_text(${JSON.stringify(claves)}::jsonb))
    `.affectedCount().build());
}

export async function eliminarFotosVencidas(
    { tx, limite }: ContextoTareaDiaria,
    diasVigencia: number,
): Promise<number> {
    const cargadasHasta = obtenerLimiteAntiguedadFotos(diasVigencia, limite);
    await iniciarVigenciaFotosAnteriores(tx);

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
            AND i."cargadaEn" <= ${cargadasHasta}::timestamptz
        ORDER BY r.espacio, r."propietarioId"
    `.returnsRow({ espacio: "pg/int4@1", propietarioId: "pg/int4@1" }).build());

    for (const propietario of propietarios) {
        await tx.execute(db.raw.sql`
            SELECT 1::int AS locked
            FROM pg_advisory_xact_lock(${propietario.espacio}, ${propietario.propietarioId})
        `.returnsRow({ locked: "pg/int4@1" }).build());
    }

    let eliminadas = 0;
    for (const propietario of propietarios) {
        const publicaciones = await tx.query(db.raw.sql`
            WITH propietarios AS (
                SELECT "publicacionId", "operadorId" AS "propietarioId", 1719 AS espacio
                FROM "publicacionOperador"
                UNION ALL
                SELECT "publicacionId", "productorId" AS "propietarioId", 1720 AS espacio
                FROM "publicacionProductor"
            )
            SELECT p.id, p.foto, i.clave
            FROM propietarios r
            JOIN publicacion p ON p.id = r."publicacionId"
            JOIN imagen i ON i.clave = replace(p.foto, '/api/publicaciones/imagenes/', 'publicaciones/')
            WHERE r.espacio = ${propietario.espacio} AND r."propietarioId" = ${propietario.propietarioId}
                AND p.foto LIKE '/api/publicaciones/imagenes/' || p.id::text || '/%'
                AND i."cargadaEn" <= ${cargadasHasta}::timestamptz
            ORDER BY p.id
            FOR UPDATE OF p
        `.returnsRow({ id: "pg/int4@1", foto: "pg/text@1", clave: "pg/text@1" }).build());

        const candidatas = publicaciones.filter((publicacion) =>
            claveDesdeUrlImagen(publicacion.foto, "publicaciones", publicacion.id) === publicacion.clave);
        if (candidatas.length === 0) continue;

        const [resultado] = await tx.query(db.raw.sql`
            WITH candidatas AS (
                SELECT id, foto, clave
                FROM jsonb_to_recordset(${JSON.stringify(candidatas)}::jsonb)
                    AS candidata(id int, foto text, clave text)
            ), actualizadas AS (
                UPDATE publicacion p
                SET foto = NULL, version = p.version + 1, fecha = CURRENT_TIMESTAMP
                FROM candidatas c
                WHERE p.id = c.id AND p.foto = c.foto
                RETURNING p.id
            ), imagenes_eliminadas AS (
                DELETE FROM imagen i
                USING candidatas c, actualizadas a
                WHERE i.clave = c.clave AND a.id = c.id
                RETURNING i.clave
            )
            SELECT count(*)::int AS cantidad FROM actualizadas
        `.returnsRow({ cantidad: "pg/int4@1" }).build());
        if (!resultado) throw new Error("No se pudo confirmar la eliminación de las fotos vencidas.");
        eliminadas += resultado.cantidad;

        if (resultado.cantidad > 0 && propietario.espacio === 1719) {
            await notificarCambioCatalogoOperador(tx, propietario.propietarioId);
        }
    }

    return eliminadas;
}
