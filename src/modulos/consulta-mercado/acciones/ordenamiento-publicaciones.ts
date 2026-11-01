import type { OrdenMercados } from "./configuracion-ordenamiento";
import type { OrdenConsulta } from "./filtros-consulta";

const equivalencias: Record<OrdenMercados, OrdenConsulta> = {
    menor_precio: "precioAsc",
    mayor_precio: "precioDesc",
    nombre_asc: "alfabeticoAsc",
    nombre_desc: "alfabeticoDesc",
    mas_vendidas: "prioridad",
};

export function convertirOrdenMercados(
    orden: OrdenMercados,
): OrdenConsulta {
    return equivalencias[orden];
}