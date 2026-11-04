import { db } from "@/infraestructura/persistencia/prisma/db";
import { enviarNotificacion } from "@/modulos/notificaciones/notificaciones";
import { Temporal } from "temporal-polyfill";

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
    const hoyPlain = ahora.toZonedDateTimeISO("America/Montevideo").toPlainDate();
    const limiteAviso = ahora.add({ hours: diasAnticipacion * 24 });

    const [operador, productor] = await Promise.all([
        db.orm.public.Operador.where({ usuarioId }).select("id").first(),
        db.orm.public.Productor.where({ usuarioId }).select("id").first(),
    ]);

    if (!operador && !productor) return;

    let publicaciones: {
        id: number;
        fechaVigencia: { readonly epochNanoseconds: bigint } | null;
        publicacionDisponible: boolean;
        especieNombre: string;
    }[] = [];

    if (operador) {
        const pubs = await db.orm.public.PublicacionOperador
            .where({ operadorId: operador.id })
            .include("publicacion", (p) =>
                p.select("id", "fechaVigencia", "publicacionDisponible")
                 .include("especie", (e) => e.select("nombreEspecie"))
            )
            .all();

        publicaciones = pubs
            .filter((rel) => rel.publicacion.fechaVigencia !== null)
            .map((rel) => ({
                id: rel.publicacion.id,
                fechaVigencia: rel.publicacion.fechaVigencia,
                publicacionDisponible: rel.publicacion.publicacionDisponible,
                especieNombre: rel.publicacion.especie.nombreEspecie,
            }));
    } else if (productor) {
        const pubs = await db.orm.public.PublicacionProductor
            .where({ productorId: productor.id })
            .include("publicacion", (p) =>
                p.select("id", "fechaVigencia", "publicacionDisponible")
                 .include("especie", (e) => e.select("nombreEspecie"))
            )
            .all();

        publicaciones = pubs
            .filter((rel) => rel.publicacion.fechaVigencia !== null)
            .map((rel) => ({
                id: rel.publicacion.id,
                fechaVigencia: rel.publicacion.fechaVigencia,
                publicacionDisponible: rel.publicacion.publicacionDisponible,
                especieNombre: rel.publicacion.especie.nombreEspecie,
            }));
    }

    if (publicaciones.length === 0) return;

    const notificacionesExistentes = await db.orm.public.Notificacion
        .where({ usuarioId })
        .select("descripcion")
        .all();
    const descripcionesSet = new Set(notificacionesExistentes.map((n) => n.descripcion));

    for (const pub of publicaciones) {
        if (!pub.fechaVigencia) continue;

        const instantVigencia = Temporal.Instant.fromEpochNanoseconds(pub.fechaVigencia.epochNanoseconds);
        const fechaVigenciaStr = instantVigencia
            .toZonedDateTimeISO("America/Montevideo")
            .toPlainDate()
            .toString();

        const yaVencio = Temporal.Instant.compare(instantVigencia, ahora) < 0;

        if (yaVencio) {
            if (pub.publicacionDisponible) {
                await db.orm.public.Publicacion.where({ id: pub.id }).update({
                    publicacionDisponible: false,
                });
            }

            const textoVencida = `Tu publicación de ${pub.especieNombre} (ID #${pub.id}) ha vencido el ${fechaVigenciaStr} y ya no está disponible.`;
            if (!descripcionesSet.has(textoVencida)) {
                await enviarNotificacion({
                    texto: textoVencida,
                    usuarios: [usuarioId],
                    url: "/mi-mercado",
                });
                descripcionesSet.add(textoVencida);
            }
        } else if (avisosHabilitados && Temporal.Instant.compare(instantVigencia, limiteAviso) <= 0) {
            const textoAviso = `Tu publicación de ${pub.especieNombre} (ID #${pub.id}) está próxima a vencer el ${fechaVigenciaStr}.`;
            if (!descripcionesSet.has(textoAviso)) {
                await enviarNotificacion({
                    texto: textoAviso,
                    usuarios: [usuarioId],
                    url: "/mi-mercado",
                });
                descripcionesSet.add(textoAviso);
            }
        }
    }
}