"use server";

import { db } from "./db";

export async function modificarPrecio(id: number, nuevoPrecio: number) {
    await db.orm.public.Publicacion
        .where({ id })
        .update({ precio: String(nuevoPrecio) as any  });
}