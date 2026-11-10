import { db } from "@/infraestructura/persistencia/prisma/db";
import { enviarNotificacion } from "@/modulos/notificaciones/notificaciones";
import { Temporal } from "temporal-polyfill";

async function registrarYEnviarAviso({
    usuarioId, publicacionId, fechaVigencia, tipo, texto, url,
}: {
    usuarioId: number;
    publicacionId: number;
    fechaVigencia: Temporal.Instant;
    tipo: "proximo" | "vencido";
    texto: string;
    url: string;
}): Promise<void> {
    await db.transaction(async (tx) => {
        const [publicacion] = await tx.query(db.raw.sql`
            SELECT id, "publicacionDisponible",
                "avisoProximoVencimientoEn" IS NOT NULL AS "avisoProximoEnviado",
                "avisoVencimientoEn" IS NOT NULL AS "avisoVencidoEnviado"
            FROM publicacion
            WHERE id = ${publicacionId} AND "fechaVigencia" = ${fechaVigencia.toString()}::timestamptz
            FOR UPDATE
        `.returnsRow({
            id: "pg/int4@1", publicacionDisponible: "pg/bool@1",
            avisoProximoEnviado: "pg/bool@1", avisoVencidoEnviado: "pg/bool@1",
        }).build());
        if (!publicacion) return;
        if (tipo === "proximo" && Temporal.Instant.compare(fechaVigencia, Temporal.Now.instant()) < 0) return;

        if (tipo === "vencido" && publicacion.publicacionDisponible) {
            await tx.orm.public.Publicacion.where({ id: publicacionId }).update({ publicacionDisponible: false });
        }

        if (tipo === "proximo" ? publicacion.avisoProximoEnviado : publicacion.avisoVencidoEnviado) return;

        const { enviadas } = await enviarNotificacion({ texto, usuarios: [usuarioId], url }, tx);
        if (enviadas > 0) {
            const enviadaEn = Temporal.Now.instant().toString();
            const actualizarAviso = tipo === "proximo"
                ? db.raw.sql`UPDATE publicacion SET "avisoProximoVencimientoEn" = ${enviadaEn}::timestamptz WHERE id = ${publicacionId} RETURNING id`
                : db.raw.sql`UPDATE publicacion SET "avisoVencimientoEn" = ${enviadaEn}::timestamptz WHERE id = ${publicacionId} RETURNING id`;
            await tx.execute(actualizarAviso.returnsRow({ id: "pg/int4@1" }).build());
        }
    });
}

export async function procesarVencimientosUsuario(usuarioId: number): Promise<void> {
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) return;

    const [configAvisoHabilitado, configDiasAnticipacion] = await Promise.all([
        db.orm.public.Configuracion
            .where({ nombreConfiguracion: "aviso_vencimiento_publicaciones_productor_habilitado" })
            .select("valorConfiguracion")
            .first(),
        db.orm.public.Configuracion
            .where({ nombreConfiguracion: "anticipacion_aviso_publicaciones_productor" })
            .select("valorConfiguracion")
            .first(),
    ]);

    const avisosHabilitados = configAvisoHabilitado?.valorConfiguracion !== "false";
    const diasAnticipacion = Math.max(1, Number(configDiasAnticipacion?.valorConfiguracion ?? 7) || 7);

    const ahora = Temporal.Now.instant();
    const limiteAviso = ahora.add({ hours: diasAnticipacion * 24 });

    const [operador, productor] = await Promise.all([
        db.orm.public.Operador.where({ usuarioId }).select("id").first(),
        db.orm.public.Productor.where({ usuarioId }).select("id").first(),
    ]);

    if (!operador && !productor) return;
    const rutaMercado = operador ? "/mi-mercado" : "/mi-mercado/productor";

    let publicaciones: {
        id: number;
        fechaVigencia: { readonly epochNanoseconds: bigint } | null;
        especieNombre: string;
        publicacionDisponible: boolean;
        avisoProximoEnviado: boolean;
        avisoVencidoEnviado: boolean;
    }[] = [];

    if (operador) {
        const pubs = await db.orm.public.PublicacionOperador
            .where({ operadorId: operador.id })
            .include("publicacion", (p) =>
                p.select("id", "fechaVigencia", "publicacionDisponible", "avisoProximoVencimientoEn", "avisoVencimientoEn")
                 .include("especie", (e) => e.select("nombreEspecie"))
            )
            .all();

        publicaciones = pubs
            .filter((rel) => rel.publicacion.fechaVigencia !== null)
            .map((rel) => ({
                id: rel.publicacion.id,
                fechaVigencia: rel.publicacion.fechaVigencia,
                especieNombre: rel.publicacion.especie.nombreEspecie,
                publicacionDisponible: rel.publicacion.publicacionDisponible,
                avisoProximoEnviado: rel.publicacion.avisoProximoVencimientoEn !== null,
                avisoVencidoEnviado: rel.publicacion.avisoVencimientoEn !== null,
            }));
    } else if (productor) {
        const pubs = await db.orm.public.PublicacionProductor
            .where({ productorId: productor.id })
            .include("publicacion", (p) =>
                p.select("id", "fechaVigencia", "publicacionDisponible", "avisoProximoVencimientoEn", "avisoVencimientoEn")
                 .include("especie", (e) => e.select("nombreEspecie"))
            )
            .all();

        publicaciones = pubs
            .filter((rel) => rel.publicacion.fechaVigencia !== null)
            .map((rel) => ({
                id: rel.publicacion.id,
                fechaVigencia: rel.publicacion.fechaVigencia,
                especieNombre: rel.publicacion.especie.nombreEspecie,
                publicacionDisponible: rel.publicacion.publicacionDisponible,
                avisoProximoEnviado: rel.publicacion.avisoProximoVencimientoEn !== null,
                avisoVencidoEnviado: rel.publicacion.avisoVencimientoEn !== null,
            }));
    }

    if (publicaciones.length === 0) return;

    for (const pub of publicaciones) {
        if (!pub.fechaVigencia) continue;

        const instantVigencia = Temporal.Instant.fromEpochNanoseconds(pub.fechaVigencia.epochNanoseconds);
        const fechaVigenciaStr = instantVigencia
            .toZonedDateTimeISO("America/Montevideo")
            .toPlainDate()
            .toString();

        const yaVencio = Temporal.Instant.compare(instantVigencia, ahora) < 0;
        const urlPublicacion = `${rutaMercado}?publicacion=${pub.id}`;

        if (yaVencio) {
            if (pub.avisoVencidoEnviado && !pub.publicacionDisponible) continue;
            const textoVencida = `Tu publicación de ${pub.especieNombre} ha vencido el ${fechaVigenciaStr} y ya no está disponible.`;
            await registrarYEnviarAviso({
                usuarioId, publicacionId: pub.id, fechaVigencia: instantVigencia,
                tipo: "vencido", texto: textoVencida, url: urlPublicacion,
            });
        } else if (avisosHabilitados && !pub.avisoProximoEnviado && Temporal.Instant.compare(instantVigencia, limiteAviso) <= 0) {
            const textoAviso = `Tu publicación de ${pub.especieNombre} está próxima a vencer el ${fechaVigenciaStr}.`;
            await registrarYEnviarAviso({
                usuarioId, publicacionId: pub.id, fechaVigencia: instantVigencia,
                tipo: "proximo", texto: textoAviso, url: urlPublicacion,
            });
        }
    }
}
