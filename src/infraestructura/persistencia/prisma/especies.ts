import { db } from "./db";

export async function obtenerEspecies() {
  return db.orm.public.Especie
    .where({ especieActiva: true })
    .all();
}