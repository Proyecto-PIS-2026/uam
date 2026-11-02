import { db } from "../../infraestructura/persistencia/prisma/db";

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
    const [visitas, contactos, publicaciones] = await Promise.all([
        db.orm.public.EstadisticaVisita.all(),
        db.orm.public.EstadisticaContacto.all(),
        db.orm.public.EstadisticaPublicacion.all(),
    ]);
    const corregirFechaLocal = (fechaDb: { toString(): string }) => {
        const isoString = new Date(fechaDb.toString()).toISOString();
        const [anio, mes, dia] = isoString.split("T")[0].split("-").map(Number);
        return new Date(anio, mes - 1, dia);
    };
    return {
        visitas: visitas.map((v) => ({
            ...v,
            fecha: corregirFechaLocal(v.fecha),
        })),
        contactos: contactos.map((c) => ({
            ...c,
            fecha: corregirFechaLocal(c.fecha),
        })),
        publicaciones: publicaciones.map((p) => ({
            ...p,
            fecha: corregirFechaLocal(p.fecha),
        })),
    };
}