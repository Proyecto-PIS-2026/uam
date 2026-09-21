import { db } from "./db";

const runtime = db.runtime();

export async function obtenerEspeciesConPublicacionesActivas() {
  const especie = db.sql.public.especie;

  const plan = db.raw.sql`
    SELECT
      e.id AS "idEspecie",
      e."nombreEspecie",
      e."fotoEspecie",
      COUNT(DISTINCT po."operadorId")::int AS "cantidadOperadores"
    FROM publicacion p
    JOIN "publicacionOperador" po ON po."publicacionId" = p.id
    JOIN presentacion pr ON pr.id = p."presentacionId"
    JOIN variedad v ON v.id = pr."variedadId"
    JOIN especie e ON e.id = v."especieId"
    WHERE p."publicacionDisponible" = true
    GROUP BY e.id, e."nombreEspecie", e."fotoEspecie"
    ORDER BY e."nombreEspecie"
  `
    .returnsRow({
      idEspecie: especie.columns.id,
      nombreEspecie: especie.columns.nombreEspecie,
      fotoEspecie: especie.columns.fotoEspecie,
      cantidadOperadores: "pg/int4@1",
    })
    .build();

  return runtime.query(plan);
}