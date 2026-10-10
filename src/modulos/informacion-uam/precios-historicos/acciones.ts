"use server";

import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import {
    inicializarHistoricosPrecios,
    type ResultadoSincronizacionHistorica,
} from "./consultas-precios-historicos";

export async function cargarHistoricosIniciales(): Promise<ResultadoSincronizacionHistorica> {
    const sesion = await obtenerSesion();
    if (sesion?.rol !== "ADMINISTRADOR") {
        throw new Error("Sólo un administrador puede iniciar la carga de históricos de precios.");
    }

    return inicializarHistoricosPrecios();
}
