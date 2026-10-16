import { autorizado } from "../../identidad-acceso/autorizacion/permisos";
import { db } from "../../../infraestructura/persistencia/prisma/db";
import { Temporal } from "@js-temporal/polyfill";
import { especiesPrioritarias } from "@/compartido/prioridad-especies";
import { normalizarFiltros, TAMANO_PAGINA, type FiltrosConsulta, type OpcionProducto } from "./filtros-consulta";

export type PublicacionListado = {
    id: number;
    precio: number | null;
    fecha: string;
    foto: string | null;
    especie: string;
    variedad: string;
    presentacion: string;
    cantidadUnidades?: number | null;
    categoria: string;
    calibre: string;
    codigoCalibre: string;
    pais: string;
    operador: {
        id: number;
        nombreFantasia: string;
        whatsApp: string;
    };
};

export type ResultadoPublicaciones = {
    publicaciones: PublicacionListado[];
    opciones: OpcionProducto[];
    total: number;
    totalCatalogo: number;
    pagina: number;
    tamanoPagina: number;
};

export async function consultarPublicaciones(filtros: FiltrosConsulta = {}): Promise<ResultadoPublicaciones> {
    if (!autorizado("operador.publicacion.consultar")) {
        throw new Error("No tiene permisos para consultar publicaciones de Operadores.");
    }
    const consulta = normalizarFiltros(filtros);
    const hoy = Temporal.Now.plainDateISO("America/Montevideo").toString();
    const prioridades = especiesPrioritarias.map((nombre) => nombre.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "")).join("|");
    const plan = db.raw.sql`
        WITH visibles AS (
            SELECT p.id, p.precio, p.fecha, p."cantidadUnidades",
                e."nombreEspecie" AS especie, v."nombreVariedad" AS variedad,
                pr."nombrePresentacion" AS presentacion, c."nombreCategoria" AS categoria,
                ca."nombreCalibre" AS calibre, ca."codigoCalibre", pa."nombrePais" AS pais,
                o.id AS "operadorId", o."nombreFantasia" AS "operadorNombreFantasia",
                o."whatsApp" AS "operadorWhatsApp"
            FROM "publicacionOperador" po
            JOIN publicacion p ON p.id = po."publicacionId"
            JOIN presentacion pr ON pr.id = p."presentacionId"
            JOIN variedad v ON v.id = pr."variedadId"
            JOIN especie e ON e.id = v."especieId"
            JOIN categoria c ON c.id = p."categoriaId"
            JOIN calibre ca ON ca.id = p."calibreId"
            JOIN pais pa ON pa.id = po."paisId"
            JOIN operador o ON o.id = po."operadorId"
            WHERE p."publicacionActiva" = true AND p."publicacionDisponible" = true
              AND EXISTS (
                SELECT 1 FROM local l WHERE l."operadorId" = o.id
                AND (l."finContrato" IS NULL OR (l."finContrato" AT TIME ZONE 'America/Montevideo')::date >= ${hoy}::date)
              )
        ), filtradas AS (
            SELECT * FROM visibles
            WHERE (${consulta.especie} = '' OR especie = ${consulta.especie})
              AND (${consulta.variedad} = '' OR variedad = ${consulta.variedad})
              AND (${consulta.presentacion} = '' OR presentacion = ${consulta.presentacion})
              AND (${consulta.categoria} = '' OR categoria = ${consulta.categoria})
              AND (${consulta.calibre} = '' OR calibre = ${consulta.calibre})
              AND (nullif(${consulta.precioMinimo ?? ""}::text, '')::numeric IS NULL OR precio >= nullif(${consulta.precioMinimo ?? ""}::text, '')::numeric)
              AND (nullif(${consulta.precioMaximo ?? ""}::text, '')::numeric IS NULL OR precio <= nullif(${consulta.precioMaximo ?? ""}::text, '')::numeric)
              AND NOT EXISTS (
                SELECT 1 FROM regexp_split_to_table(${consulta.busqueda}, '[[:space:]]+') AS palabra
                WHERE palabra <> '' AND NOT EXISTS (
                    SELECT 1 FROM unnest(ARRAY[especie, variedad, presentacion, categoria, calibre, "codigoCalibre", "operadorNombreFantasia"]) AS campo
                    WHERE strpos(translate(lower(campo), 'áéíóúüñ', 'aeiouun'), palabra) > 0
                )
              )
        ), ordenadas AS (
            SELECT *, row_number() OVER (ORDER BY
                CASE WHEN ${consulta.orden} = 'precioAsc' THEN precio END ASC NULLS LAST,
                CASE WHEN ${consulta.orden} = 'precioDesc' THEN precio END DESC NULLS LAST,
                CASE WHEN ${consulta.orden} = 'prioridad' THEN coalesce(array_position(string_to_array(${prioridades}, '|'), translate(lower(especie), 'áéíóúüñ', 'aeiouun')), 100) END,
                CASE WHEN ${consulta.orden} IN ('prioridad', 'alfabeticoAsc') THEN translate(lower(especie), 'áéíóúüñ', 'aeiouun') END ASC,
                CASE WHEN ${consulta.orden} IN ('prioridad', 'alfabeticoAsc') THEN translate(lower(variedad), 'áéíóúüñ', 'aeiouun') END ASC,
                CASE WHEN ${consulta.orden} = 'alfabeticoDesc' THEN translate(lower(especie), 'áéíóúüñ', 'aeiouun') END DESC,
                CASE WHEN ${consulta.orden} = 'alfabeticoDesc' THEN translate(lower(variedad), 'áéíóúüñ', 'aeiouun') END DESC,
                id
            ) AS posicion FROM filtradas
        ), limites AS (
            SELECT count(*)::int AS total,
                least(${consulta.pagina}, greatest(1, ceil(count(*)::numeric / ${TAMANO_PAGINA})::int)) AS pagina
            FROM filtradas
        ), pagina AS (
            SELECT ordenadas.* FROM ordenadas
            ORDER BY posicion LIMIT ${TAMANO_PAGINA} OFFSET (SELECT (pagina - 1) * ${TAMANO_PAGINA} FROM limites)
        )
        SELECT jsonb_build_object(
            'publicaciones', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'id', pagina.id, 'precio', pagina.precio, 'fecha', pagina.fecha, 'foto', p.foto,
                'cantidadUnidades', pagina."cantidadUnidades", 'especie', pagina.especie, 'variedad', pagina.variedad,
                'presentacion', pagina.presentacion, 'categoria', pagina.categoria, 'calibre', pagina.calibre,
                'codigoCalibre', pagina."codigoCalibre", 'pais', pagina.pais,
                'operador', jsonb_build_object('id', pagina."operadorId", 'nombreFantasia', pagina."operadorNombreFantasia", 'whatsApp', pagina."operadorWhatsApp")
            ) ORDER BY pagina.posicion) FROM pagina JOIN publicacion p ON p.id = pagina.id), '[]'::jsonb),
            'opciones', coalesce((SELECT jsonb_agg(opcion ORDER BY especie, variedad, presentacion, categoria, calibre)
                FROM (SELECT DISTINCT especie, variedad, presentacion, categoria, calibre FROM visibles) AS opcion), '[]'::jsonb),
            'total', (SELECT total FROM limites), 'totalCatalogo', (SELECT count(*)::int FROM visibles),
            'pagina', (SELECT pagina FROM limites), 'tamanoPagina', ${TAMANO_PAGINA}::int
        )::text AS resultado
    `.returnsRow({ resultado: "pg/text@1" }).build();
    const filas = await db.runtime().query(plan);
    if (!filas[0]) throw new Error("No se pudieron consultar las publicaciones.");
    return JSON.parse(filas[0].resultado) as ResultadoPublicaciones;
}
