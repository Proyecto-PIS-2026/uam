import obtenerConfiguraciones from "@/modulos/administracion/acciones/consultas-configuracion";

export type OrdenLanding =
    | "nombre_asc"
    | "nombre_desc"
    | "mas_vendidas";

export type OrdenMercados =
    | OrdenLanding
    | "menor_precio"
    | "mayor_precio";

export interface ConfiguracionOrdenamiento {
    habilitado: boolean;
    ordenLanding: OrdenLanding;
    ordenMercados: OrdenMercados;
}

function interpretarOrdenLanding(
    valor: string | null | undefined,
): OrdenLanding {
    switch (valor) {
        case "nombre_asc":
        case "nombre_desc":
        case "mas_vendidas":
            return valor;
        default:
            return "mas_vendidas";
    }
}

function interpretarOrdenMercados(
    valor: string | null | undefined,
): OrdenMercados {
    switch (valor) {
        case "menor_precio":
        case "mayor_precio":
        case "nombre_asc":
        case "nombre_desc":
        case "mas_vendidas":
            return valor;
        default:
            return "mas_vendidas";
    }
}

export async function obtenerConfiguracionOrdenamiento():
    Promise<ConfiguracionOrdenamiento> {
    const filas = await obtenerConfiguraciones([
        "ordenamiento_habilitado",
        "orden_landing_page_default",
        "orden_mercados_default",
    ]);

    const valores = new Map(
        filas.map(({ nombreConfiguracion, valorConfiguracion }) => [
            nombreConfiguracion,
            valorConfiguracion,
        ]),
    );

    return {
        habilitado: valores.get("ordenamiento_habilitado") === "true",
        ordenLanding: interpretarOrdenLanding(
            valores.get("orden_landing_page_default"),
        ),
        ordenMercados: interpretarOrdenMercados(
            valores.get("orden_mercados_default"),
        ),
    };
}