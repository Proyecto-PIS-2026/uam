"use server";

import { actualizarPrecioPublicacion } from "@/infraestructura/persistencia/prisma/publicaciones";

export async function actualizarPrecio(publicacionId: number, nuevoPrecio: number) {
    await actualizarPrecioPublicacion(publicacionId, nuevoPrecio);
}