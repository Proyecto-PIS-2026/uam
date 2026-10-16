"use server";

import { consultarPublicacionesProductores, type ResultadoPublicacionesProductores } from "./PublicacionesProductor";
import { exigirConsultaMercadoOperador } from "@/modulos/identidad-acceso/autorizacion/controles";
import type { DatosSesion } from "../../identidad-acceso/autenticacion/sesiones";

export default async function obtenerPublicaciones(sesion: DatosSesion | null): Promise<ResultadoPublicacionesProductores | null> {
  await exigirConsultaMercadoOperador();
  return consultarPublicacionesProductores(sesion);
}