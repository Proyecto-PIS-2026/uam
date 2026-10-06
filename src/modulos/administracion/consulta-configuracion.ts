import { db } from "../../infraestructura/persistencia/prisma/db";

const runtime = db.runtime();

export default async function obtenerConfiguracion() {
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