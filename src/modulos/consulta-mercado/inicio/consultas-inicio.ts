import { db } from "../../../infraestructura/persistencia/prisma/db";

const runtime = db.runtime();

export async function obtenerEspeciesConPublicacionesActivas() {
  const especie = db.sql.public.especie;

  const plan = db.raw.sql`
    SELECT
      e."nombreEspecie",
      e."fotoEspecie",
      COUNT(DISTINCT po."operadorId")::int AS "cantidadOperadores"
    FROM publicacion p
    JOIN "publicacionOperador" po ON po."publicacionId" = p.id
    JOIN presentacion pr ON pr.id = p."presentacionId"
    JOIN variedad v ON v.id = pr."variedadId"
    JOIN especie e ON e.id = v."especieId"
    WHERE p."publicacionDisponible" = true
      AND p."publicacionActiva" = true
    GROUP BY e."nombreEspecie", e."fotoEspecie"
    ORDER BY e."nombreEspecie"
  `
    .returnsRow({
      nombreEspecie: especie.columns.nombreEspecie,
      fotoEspecie: especie.columns.fotoEspecie,
      cantidadOperadores: "pg/int4@1",
    })
    .build();

  return runtime.query(plan);
}

export async function obtenerEspeciesInicio() {
  const especies = await obtenerEspeciesConPublicacionesActivas();

  return especies.map((especie) => ({
    nombreEspecie: especie.nombreEspecie,
    cantidadOperadores: especie.cantidadOperadores,
    fotoEspecie: especie.fotoEspecie,
  }));
}

export async function obtenerUrlListaInteligente() {
  const configuracion = db.sql.public.configuracion;
  const plan = db.raw.sql`
    SELECT c."valorConfiguracion"
    FROM public.configuracion c
    WHERE c."nombreConfiguracion" = 'url_lista_inteligente'
    LIMIT 1
  `
    .returnsRow({
      valorConfiguracion: configuracion.columns.valorConfiguracion,
    })
    .build();
  const [resultado] = await runtime.query(plan);
  return resultado?.valorConfiguracion ?? null;
}