import { autorizado } from "../../identidad-acceso/autorizacion/permisos";
import { db } from "../../../infraestructura/persistencia/prisma/db";
import { Temporal } from "@js-temporal/polyfill";

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
};

export async function consultarPublicaciones(): Promise<ResultadoPublicaciones> {
    if (!autorizado("operador.publicacion.consultar")) {
        throw new Error("No tiene permisos para consultar publicaciones de Operadores.");
    }

    const tablas = db.sql.public;
    const hoy = Temporal.Now.plainDateISO("America/Montevideo").toString();
    const plan = db.raw.sql`
        SELECT p.id, p.precio, p.fecha, p.foto, p."cantidadUnidades",
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
        WHERE p."publicacionActiva" = true
          AND p."publicacionDisponible" = true
          AND EXISTS (
            SELECT 1
            FROM local l
            WHERE l."operadorId" = o.id
              AND (
                l."finContrato" IS NULL
                OR (l."finContrato" AT TIME ZONE 'America/Montevideo')::date >= ${hoy}::date
              )
          )
    `.returnsRow({
        id: tablas.publicacion.columns.id,
        precio: tablas.publicacion.columns.precio,
        fecha: tablas.publicacion.columns.fecha,
        foto: tablas.publicacion.columns.foto,
        cantidadUnidades: tablas.publicacion.columns.cantidadUnidades,
        especie: tablas.especie.columns.nombreEspecie,
        variedad: tablas.variedad.columns.nombreVariedad,
        presentacion: tablas.presentacion.columns.nombrePresentacion,
        categoria: tablas.categoria.columns.nombreCategoria,
        calibre: tablas.calibre.columns.nombreCalibre,
        codigoCalibre: tablas.calibre.columns.codigoCalibre,
        pais: tablas.pais.columns.nombrePais,
        operadorId: tablas.operador.columns.id,
        operadorNombreFantasia: tablas.operador.columns.nombreFantasia,
        operadorWhatsApp: tablas.operador.columns.whatsApp,
    }).build();
    const filas = await db.runtime().query(plan);
    const publicaciones: PublicacionListado[] = filas.map((fila) => ({
        id: Number(fila.id),
        precio: fila.precio === null ? null : Number(fila.precio),
        fecha: fila.fecha.toString(),
        foto: fila.foto,
        especie: fila.especie,
        variedad: fila.variedad,
        presentacion: fila.presentacion,
        cantidadUnidades: fila.cantidadUnidades === null ? null : Number(fila.cantidadUnidades),
        categoria: fila.categoria,
        calibre: fila.calibre,
        codigoCalibre: fila.codigoCalibre,
        pais: fila.pais,
        operador: {
            id: Number(fila.operadorId),
            nombreFantasia: fila.operadorNombreFantasia,
            whatsApp: fila.operadorWhatsApp
        }
    }));

    return { publicaciones };
}