"use server";

import {
  consultarPublicaciones,
  type ResultadoPublicaciones
} from "./Publicaciones";
import { exigirConsultaMercadoPublico } from "@/modulos/identidad-acceso/autorizacion/controles";

import type { FiltrosConsulta } from "./filtros-consulta";

export default async function obtenerPublicaciones(filtros: FiltrosConsulta = {}): Promise<ResultadoPublicaciones | null> {
  await exigirConsultaMercadoPublico();
  return consultarPublicaciones(filtros);
}