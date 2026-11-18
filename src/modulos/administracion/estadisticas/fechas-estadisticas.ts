import { Temporal } from "temporal-polyfill";

// Día del negocio, compartido por las escrituras y los filtros de estadísticas.
export function obtenerFechaEstadistica(): string {
    return Temporal.Now.plainDateISO("America/Montevideo").toString();
}
