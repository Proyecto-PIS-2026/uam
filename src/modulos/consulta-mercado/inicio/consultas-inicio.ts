import { autorizado } from "../../identidad-acceso/autorizacion/permisos";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "../../../infraestructura/persistencia/prisma/db";

const runtime = db.runtime();

export async function obtenerEspeciesConPublicacionesActivas() {
    if (!autorizado("operador.publicacion.consultar")) {
        throw new Error("No tiene permisos para consultar publicaciones de Operadores.");
    }

    const especie = db.sql.public.especie;
    const hoy = Temporal.Now.plainDateISO("America/Montevideo").toString();

    const plan = db.raw.sql`
        SELECT
            e."nombreEspecie",
            e."fotoEspecie",
            COUNT(DISTINCT po."operadorId")::int AS "cantidadOperadores"
        FROM publicacion p
        JOIN "publicacionOperador" po ON po."publicacionId" = p.id
        JOIN operador o ON o.id = po."operadorId"
        JOIN usuario u ON u.id = o."usuarioId" AND u.habilitado = true
        JOIN especie e ON e.id = p."especieId"
        WHERE p."publicacionDisponible" = true
            AND p."publicacionActiva" = true
            AND p."tipoPublicacion" = 'OPERADOR'
            AND (p."fechaVigencia" IS NULL OR (p."fechaVigencia" AT TIME ZONE 'America/Montevideo')::date >= ${hoy}::date)
            AND EXISTS (
                SELECT 1
                FROM local l
                WHERE l."operadorId" = po."operadorId"
                    AND (
                        l."finContrato" IS NULL
                        OR (l."finContrato" AT TIME ZONE 'America/Montevideo')::date >= ${hoy}::date
                    )
            )
        GROUP BY e.id, e."nombreEspecie", e."fotoEspecie"
        ORDER BY e."nombreEspecie"
    `.returnsRow({
        nombreEspecie: especie.columns.nombreEspecie,
        fotoEspecie: especie.columns.fotoEspecie,
        cantidadOperadores: "pg/int4@1",
    }).build();

    return runtime.query(plan);
}

export async function obtenerEspeciesInicio() {
    const especies = await obtenerEspeciesConPublicacionesActivas();

    return especies.map((especie) => ({
        nombreEspecie: especie.nombreEspecie,
        cantidadOperadores: especie.cantidadOperadores,
        fotoGenerica: especie.fotoEspecie,
    }));
}

export async function obtenerUrlListaInteligente() {
    if (!autorizado("listaInteligente.consultar")) {
        throw new Error("No tiene permisos para consultar la Lista Inteligente.");
    }

    const configuracion = db.sql.public.configuracion;

    const plan = db.raw.sql`
        SELECT c."valorConfiguracion"
        FROM public.configuracion c
        WHERE c."nombreConfiguracion" = 'url_lista_inteligente'
        LIMIT 1
    `.returnsRow({
        valorConfiguracion: configuracion.columns.valorConfiguracion,
    }).build();

    const [resultado] = await runtime.query(plan);
    return resultado?.valorConfiguracion ?? null;
}