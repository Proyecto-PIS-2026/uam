import { db } from "./db";
import { all } from "@prisma/orm-postgres/orm-client";

export async function obtenerEspecies() {
  const especies = await db.orm.public.Especie
    .where(() => all());

  const resultado = await especies.all();
  return resultado;
}