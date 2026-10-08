import { db } from "../../infraestructura/persistencia/prisma/db";

const runtime = db.runtime();

export default async function obtenerConfiguraciones() {
    const configuracion = db.sql.public.configuracion;
    const plan = db.raw.sql`
        SELECT
            c."nombreConfiguracion",
            c."valorConfiguracion"
        FROM public.configuracion c
    `
        .returnsRow({
            nombreConfiguracion: configuracion.columns.nombreConfiguracion,
            valorConfiguracion: configuracion.columns.valorConfiguracion,
        })
        .build();
    return runtime.query(plan);
}

export async function obtenerConfiguracion(nombre: string) {
    const configuracion = db.sql.public.configuracion;
    const plan = db.raw.sql`
        SELECT c."valorConfiguracion"
        FROM public.configuracion c
        WHERE c."nombreConfiguracion" = ${nombre}
        LIMIT 1
    `
        .returnsRow({
            valorConfiguracion: configuracion.columns.valorConfiguracion,
        })
        .build();
    const [resultado] = await runtime.query(plan);
    return resultado?.valorConfiguracion ?? null;
}

export async function actualizarConfiguracion(nombre: string, valor: string,) {
    const configuracion = db.sql.public.configuracion;
    const plan = db.raw.sql`
        UPDATE public.configuracion
        SET "valorConfiguracion" = ${valor}
        WHERE "nombreConfiguracion" = ${nombre}
        RETURNING "valorConfiguracion"
    `
        .returnsRow({
            valorConfiguracion:configuracion.columns.valorConfiguracion,
        })
        .build();
    const [resultado] = await runtime.query(plan);
    if (!resultado) {
        throw new Error(`No existe la configuración ${nombre}.`);
    }
    return resultado.valorConfiguracion;
}