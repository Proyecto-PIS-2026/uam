"use server";

import {
  consultarPublicaciones,
  type ResultadoPublicaciones
} from "./Publicaciones";

export async function obtenerPublicaciones(): Promise<ResultadoPublicaciones | null> {
  return consultarPublicaciones();
}