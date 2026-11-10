export type ValorHistorico = string | number | boolean | null | ValorHistorico[] | { [clave: string]: ValorHistorico };

export type PrecioHistorico = {
    category: ValorHistorico;
    min_kg: ValorHistorico;
    max_kg: ValorHistorico;
    min_un: ValorHistorico;
    max_un: ValorHistorico;
    is_reference: ValorHistorico;
};

export type PresentacionHistorica = {
    variety: ValorHistorico;
    caliber: ValorHistorico;
    country: ValorHistorico;
    measure_unit: ValorHistorico;
    prices: PrecioHistorico[];
};

export type RegistroHistorico = {
    date: ValorHistorico;
    presentations: PresentacionHistorica[];
    volume_kg?: ValorHistorico;
};

export type HistoricoProducto = {
    classification_id: ValorHistorico;
    classification: ValorHistorico;
    species_id: number;
    species: ValorHistorico;
    from: string;
    to: string;
    series: RegistroHistorico[];
};

export type ProductoSeleccionado = {
    id: string;
    especie: string;
    variedad: string;
    pais: string;
    calibre: string;
    categoria: string;
};

export type EspecieHistorica = {
    id: string;
    especie: string;
};

export type OpcionesFiltrosHistoricos = {
    variedades: string[];
    paises: string[];
    calibres: string[];
    categorias: string[];
};
