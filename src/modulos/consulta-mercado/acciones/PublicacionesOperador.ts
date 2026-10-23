import { autorizado } from "../../identidad-acceso/autorizacion/permisos";
import { db } from "../../../infraestructura/persistencia/prisma/db";
import { Temporal } from "temporal-polyfill";
import { especiesPrioritarias } from "@/compartido/prioridad-especies";
import { normalizarFiltros, type FiltrosConsulta, type OpcionProducto } from "./filtros-consulta";

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
    tipoPublicacion: "OPERADOR";
    operador: {
        id: number;
        nombreFantasia: string;
        whatsApp: string;
    };
};

export type ResultadoPublicaciones = {
    publicaciones: PublicacionListado[];
    opciones: OpcionProducto[];
    naves: string[];
    total: number;
    totalCatalogo: number;
};

export async function consultarPublicaciones(filtros: FiltrosConsulta = {}): Promise<ResultadoPublicaciones> {
    if (!autorizado("operador.publicacion.consultar")) {
        throw new Error("No tiene permisos para consultar publicaciones de Operadores.");
    }
    const consulta = normalizarFiltros(filtros);
    const hoy = Temporal.Now.plainDateISO("America/Montevideo").toString();
    const prioridades = especiesPrioritarias.map((nombre) => nombre.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "")).join("|");
    const plan = db.raw.sql`
        WITH locales_vigentes AS (
            SELECT l."operadorId", n."nombreNave"
            FROM local l JOIN nave n ON n.id = l."naveId"
            WHERE l."finContrato" IS NULL OR (l."finContrato" AT TIME ZONE 'America/Montevideo')::date >= ${hoy}::date
        ), visibles AS (
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
            WHERE p."tipoPublicacion" = 'OPERADOR' AND p."publicacionActiva" = true AND p."publicacionDisponible" = true
              AND EXISTS (
                SELECT 1 FROM locales_vigentes l WHERE l."operadorId" = o.id
              )
        ), filtradas AS (
            SELECT * FROM visibles
            WHERE (${consulta.especie} = '' OR especie = ${consulta.especie})
              AND (${consulta.variedad} = '' OR variedad = ${consulta.variedad})
              AND (${consulta.presentacion} = '' OR presentacion = ${consulta.presentacion})
              AND (${consulta.categoria} = '' OR categoria = ${consulta.categoria})
              AND (${consulta.calibre} = '' OR calibre = ${consulta.calibre})
              AND (${consulta.nave} = '' OR EXISTS (
                SELECT 1 FROM locales_vigentes l
                WHERE l."operadorId" = visibles."operadorId" AND l."nombreNave" = ${consulta.nave}
              ))
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
        )
        SELECT jsonb_build_object(
            'publicaciones', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'tipoPublicacion', 'OPERADOR', 'id', ordenadas.id, 'precio', ordenadas.precio, 'fecha', ordenadas.fecha, 'foto', p.foto,
                'cantidadUnidades', ordenadas."cantidadUnidades", 'especie', ordenadas.especie, 'variedad', ordenadas.variedad,
                'presentacion', ordenadas.presentacion, 'categoria', ordenadas.categoria, 'calibre', ordenadas.calibre,
                'codigoCalibre', ordenadas."codigoCalibre", 'pais', ordenadas.pais,
                'operador', jsonb_build_object('id', ordenadas."operadorId", 'nombreFantasia', ordenadas."operadorNombreFantasia", 'whatsApp', ordenadas."operadorWhatsApp")
            ) ORDER BY ordenadas.posicion) FROM ordenadas JOIN publicacion p ON p.id = ordenadas.id), '[]'::jsonb),
            'opciones', coalesce((SELECT jsonb_agg(opcion ORDER BY especie, variedad, presentacion, categoria, calibre)
                FROM (SELECT DISTINCT especie, variedad, presentacion, categoria, calibre FROM visibles) AS opcion), '[]'::jsonb),
            'naves', coalesce((SELECT jsonb_agg("nombreNave" ORDER BY "nombreNave")
                FROM (SELECT DISTINCT l."nombreNave" FROM locales_vigentes l
                    WHERE EXISTS (SELECT 1 FROM visibles v WHERE v."operadorId" = l."operadorId")) AS naves), '[]'::jsonb),
            'total', (SELECT count(*)::int FROM filtradas), 'totalCatalogo', (SELECT count(*)::int FROM visibles)
        )::text AS resultado
    `.returnsRow({ resultado: "pg/text@1" }).build();
    const filas = await db.runtime().query(plan);
    if (!filas[0]) throw new Error("No se pudieron consultar las publicaciones.");
    return JSON.parse(filas[0].resultado) as ResultadoPublicaciones;
}
