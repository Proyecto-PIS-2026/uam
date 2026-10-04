export type PrecioHistorico = {
    category: string;
    min_kg: number;
    max_kg: number;
    min_un: number;
    max_un: number;
    is_reference: boolean;
};

export type PresentacionHistorica = {
    variety: string;
    caliber: string;
    country: string;
    measure_unit: string;
    prices: PrecioHistorico[];
};

export type RegistroHistorico = {
    date: string;
    presentations: PresentacionHistorica[];
    volume_kg: number;
};

export type HistoricoProducto = {
    classification_id: number;
    classification: string;
    species_id: number;
    species: string;
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
