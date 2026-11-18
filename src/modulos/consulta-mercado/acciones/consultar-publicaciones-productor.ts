"use server";

import { exigirConsultaProductores } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { consultarPublicacionesProductores } from "../consultas/consultas-publicaciones-productor";

export default async function obtenerPublicacionesProductores() {
    const sesion = await controlarSesionEnAccion(exigirConsultaProductores);
    return consultarPublicacionesProductores(sesion);
}
