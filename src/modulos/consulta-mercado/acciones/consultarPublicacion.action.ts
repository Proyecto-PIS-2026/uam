"use server";

import {
  consultarPublicacion,
  type publicacionCompleta,
} from "./publicaciones";

export async function obtenerDetallePublicacion(id: number): Promise<publicacionCompleta | null> {
  return consultarPublicacion(id);
}