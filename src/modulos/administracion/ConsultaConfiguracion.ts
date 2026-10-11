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