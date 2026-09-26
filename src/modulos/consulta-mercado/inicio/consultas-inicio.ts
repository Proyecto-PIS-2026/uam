import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../../../infraestructura/persistencia/prisma/db";

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
      AND p."publicacionActiva" = true
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

function nombreArchivoEspecie(nombre: string) {
  return nombre
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function obtenerArchivosGenericos() {
  try {
    return new Set(await readdir(join(process.cwd(), "public", "generico")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set<string>();
    throw error;
  }
}

function buscarFotoGenerica(nombre: string, archivos: Set<string>) {
  const nombreBase = nombreArchivoEspecie(nombre);

  for (const extension of [".webp", ".png", ".jpg"]) {
    const archivo = `${nombreBase}${extension}`;
    if (archivos.has(archivo)) return `/generico/${archivo}`;
  }

  return null;
}

export async function obtenerEspeciesInicio() {
  const [especies, archivosGenericos] = await Promise.all([
    obtenerEspeciesConPublicacionesActivas(),
    obtenerArchivosGenericos(),
  ]);

  return especies.map((especie) => ({
    idEspecie: especie.idEspecie,
    nombreEspecie: especie.nombreEspecie,
    cantidadOperadores: especie.cantidadOperadores,
    fotoGenerica: buscarFotoGenerica(especie.nombreEspecie, archivosGenericos),
  }));
}
