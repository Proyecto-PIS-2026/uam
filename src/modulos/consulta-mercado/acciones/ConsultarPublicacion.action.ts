"use server";

import {
  consultarPublicaciones,
  type ResultadoPublicaciones
} from "./Publicaciones";

export default async function obtenerPublicaciones(): Promise<ResultadoPublicaciones | null> {
  return consultarPublicaciones();
}