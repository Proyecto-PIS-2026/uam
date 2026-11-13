import { db } from "../../../infraestructura/persistencia/prisma/db";

export default async function obtenerConfiguraciones(nombres: readonly string[]) {
    if (nombres.length === 0) return [];

    return db.orm.public.Configuracion
        .where((configuracion) => configuracion.nombreConfiguracion.in([...nombres]))
        .select("nombreConfiguracion", "valorConfiguracion")
        .all();
}

export async function obtenerConfiguracion(nombre: string) {
    const resultado = await db.orm.public.Configuracion
        .where({ nombreConfiguracion: nombre })
        .select("valorConfiguracion")
        .first();

    return resultado?.valorConfiguracion ?? null;
}

export async function actualizarConfiguracion(nombre: string, valor: string) {
    const resultado = await db.orm.public.Configuracion
        .where({ nombreConfiguracion: nombre })
        .select("valorConfiguracion")
        .update({ valorConfiguracion: valor });

    if (!resultado) {
        throw new Error(`No existe la configuración ${nombre}.`);
    }

    return resultado.valorConfiguracion;
}

export async function obtenerEstadisticas() {
    const [
        visitas,
        contactos,
        publicaciones,
        contactosPorPublicacion,
        cantidadPublicaciones,
    ] = await Promise.all([
        db.orm.public.EstadisticaVisita.all(),
        db.orm.public.EstadisticaContacto.all(),
        db.orm.public.EstadisticaPublicacion.all(),
        db.orm.public.EstadisticaContactoPublicacion.all(),
        db.orm.public.EstadisticaCantidadPublicacion.all(),
    ]);

    // La medianoche UTC representa el día estadístico, no la hora de la operación.
    const fechaCalendario = (fechaDb: { toString(): string }) =>
        new Date(fechaDb.toString()).toISOString().slice(0, 10);

    return {
        visitas: visitas.map((v) => ({
            ...v,
            fecha: fechaCalendario(v.fecha),
        })),
        contactos: contactos.map((c) => ({
            ...c,
            fecha: fechaCalendario(c.fecha),
        })),
        publicaciones: publicaciones.map((p) => ({
            ...p,
            fecha: fechaCalendario(p.fecha),
        })),
        contactosPorPublicacion: contactosPorPublicacion.map((c) => ({
            ...c,
            fecha: fechaCalendario(c.fecha),
        })),
        cantidadPublicaciones: cantidadPublicaciones.map((p) => ({
            ...p,
            fecha: fechaCalendario(p.fecha),
        })),
    };
}
