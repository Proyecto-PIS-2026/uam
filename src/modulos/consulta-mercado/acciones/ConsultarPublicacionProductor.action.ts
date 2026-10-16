"use server";

import {
  consultarPublicacionesProductor,
  type ResultadoPublicacionesProductor
} from "./PublicacionesProductor";
import { exigirConsultaMercadoOperador } from "@/modulos/identidad-acceso/autorizacion/controles";

export default async function obtenerPublicaciones(): Promise<ResultadoPublicacionesProductor | null> {
  await exigirConsultaMercadoOperador();
  return consultarPublicacionesProductor();
}