"use server";

import {
  consultarPublicaciones,
  type ResultadoPublicaciones
} from "./publicaciones";

export async function obtenerPublicaciones(): Promise<ResultadoPublicaciones | null> {
  return consultarPublicaciones();
}