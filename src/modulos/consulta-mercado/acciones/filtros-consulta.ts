import { esEntradaPrecioPublicacion } from "@/modulos/publicaciones/precio-publicacion";

export type OrdenConsulta = "ninguno" | "prioridad" | "precioAsc" | "precioDesc" | "alfabeticoAsc" | "alfabeticoDesc";

export type FiltrosConsulta = {
    busqueda?: string;
    especie?: string;
    variedad?: string;
    presentacion?: string;
    categoria?: string;
    calibre?: string;
    nave?: string;
    precioMinimo?: string;
    precioMaximo?: string;
    orden?: OrdenConsulta;
};

export type OpcionProducto = {
    especie: string;
    variedad: string;
    presentacion: string;
    categoria: string;
    calibre: string;
};

export function normalizarFiltros(valor: FiltrosConsulta = {}) {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new Error("Los filtros no son válidos.");
    const texto = (campo: keyof FiltrosConsulta, limite = 100) => {
        const dato = valor[campo];
        if (dato === undefined || dato === "Todas") return "";
        if (typeof dato !== "string" || dato.length > limite) throw new Error("Los filtros no son válidos.");
        return dato.trim();
    };
    const precio = (campo: "precioMinimo" | "precioMaximo") => {
        const dato = texto(campo, 15);
        if (dato === "") return null;
        const numero = Number(dato);
        if (!esEntradaPrecioPublicacion(dato)) throw new Error("El precio del filtro debe ser un número entero positivo de hasta 10 dígitos.");
        return numero;
    };
    const orden = valor.orden ?? "prioridad";
    if (!["ninguno", "prioridad", "precioAsc", "precioDesc", "alfabeticoAsc", "alfabeticoDesc"].includes(orden)) throw new Error("El orden no es válido.");
    return {
        busqueda: texto("busqueda", 200).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        especie: texto("especie"), variedad: texto("variedad"), presentacion: texto("presentacion"),
        categoria: texto("categoria"), calibre: texto("calibre"), nave: texto("nave"),
        precioMinimo: precio("precioMinimo"), precioMaximo: precio("precioMaximo"), orden,
    };
}
