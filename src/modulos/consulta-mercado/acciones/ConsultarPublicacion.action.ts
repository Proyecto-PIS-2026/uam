"use server";

import {
  consultarPublicaciones,
  type ResultadoPublicaciones
} from "./Publicaciones";
import { exigirConsultaMercadoPublico } from "@/modulos/identidad-acceso/autorizacion/controles";

export default async function obtenerPublicaciones(): Promise<ResultadoPublicaciones | null> {
  await exigirConsultaMercadoPublico();
  return consultarPublicaciones();
}