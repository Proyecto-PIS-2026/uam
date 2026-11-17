import { compararEspeciesPorPrioridad } from "../../../compartido/prioridad-especies";
import { compararPorPonderacionYFecha } from "../ponderacion-publicacion";
import type { PublicacionListado } from "../../consulta-mercado/consultas/consultas-publicaciones-operador";
import type { OrdenConsulta } from "../../consulta-mercado/filtros/filtros-consulta";
import type { PublicacionFiltrable } from "./tipos";

export const compararOpciones = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" });

export const compararPrecios = (a: PublicacionFiltrable, b: PublicacionFiltrable, ascendente: boolean) => {
    if (a.precio == null && b.precio == null) return 0;
    if (a.precio == null) return 1;
    if (b.precio == null) return -1;

    return ascendente ? a.precio - b.precio : b.precio - a.precio;
};

export function compararPublicacionesAlfabeticamente(a: Pick<PublicacionFiltrable, "especie" | "variedad">, b: Pick<PublicacionFiltrable, "especie" | "variedad">) {
    const especie = compararOpciones(a.especie, b.especie);
    return especie !== 0 ? especie : compararOpciones(a.variedad, b.variedad);
}

export function compararPublicacionesPorPrioridad(a: Pick<PublicacionFiltrable, "especie" | "variedad">, b: Pick<PublicacionFiltrable, "especie" | "variedad">) {
    const especie = compararEspeciesPorPrioridad(a.especie, b.especie);
    return especie !== 0 ? especie : compararOpciones(a.variedad, b.variedad);
}

export function compararPublicacionesOperador(a: PublicacionListado, b: PublicacionListado, orden: OrdenConsulta): number {
    let comparacion = 0;
    switch (orden) {
        case "precioAsc":
            comparacion = compararPrecios(a, b, true);
            break;
        case "precioDesc":
            comparacion = compararPrecios(a, b, false);
            break;
        case "alfabeticoAsc":
            comparacion = compararOpciones(a.especie, b.especie);
            break;
        case "alfabeticoDesc":
            comparacion = compararOpciones(b.especie, a.especie);
            break;
        case "prioridad":
            comparacion = compararEspeciesPorPrioridad(a.especie, b.especie);
            break;
        case "fechaDesc":
            comparacion = new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
            break;
    }
    return comparacion || compararPorPonderacionYFecha(a, b);
}

