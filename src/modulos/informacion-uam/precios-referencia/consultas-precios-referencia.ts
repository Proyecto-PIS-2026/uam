import consultaLocal from "./consulta-referencia.json";

export type ConsultaPreciosReferencia = {
    survey_date: string;
    types: {
        classification_id: number;
        classification: string;
        products: {
            species_id: number;
            species: string;
            varieties: {
                variety: string;
                presentations: {
                    caliber: string;
                    country: string;
                    measure_unit: string;
                    prices: { category: string; min_kg: number; max_kg: number; min_un: number; max_un: number; is_reference: boolean }[];
                }[];
            }[];
        }[];
    }[];
};

export type PrecioReferencia = {
    id: string;
    especie: string;
    variedad: string;
    calibre: string;
    pais: string;
    unidad: string;
    categoria: string;
    precioMinimoUnidad: number;
    precioMaximoUnidad: number;
    precioMinimoKg: number;
    precioMaximoKg: number;
    esReferencia: boolean;
};

export type ResultadoPreciosReferencia = { fechaRelevamiento: string; filas: PrecioReferencia[] };

export async function obtenerConsultaPreciosReferencia(): Promise<ConsultaPreciosReferencia> {
    const fuente = process.env.PRECIOS_REFERENCIA_FUENTE || "local";

    if (fuente === "local") return consultaLocal;
    if (fuente !== "webservice") {
        throw new Error("PRECIOS_REFERENCIA_FUENTE debe ser local o webservice.");
    }

    const { obtenerConsultaDiariaWebservice } = await import("./cache-diario");
    return obtenerConsultaDiariaWebservice();
}

export function convertirConsultaEnPreciosReferencia(consulta: ConsultaPreciosReferencia): ResultadoPreciosReferencia {
    const filas: PrecioReferencia[] = [];

    for (const tipo of consulta.types) {
        for (const producto of tipo.products) {
            for (const variedad of producto.varieties) {
                for (const presentacion of variedad.presentations) {
                    for (const precio of presentacion.prices) {
                        filas.push({
                            id: JSON.stringify([
                                tipo.classification_id,
                                producto.species_id,
                                variedad.variety,
                                presentacion.caliber,
                                presentacion.country,
                                presentacion.measure_unit,
                                precio.category,
                            ]),
                            especie: producto.species,
                            variedad: variedad.variety,
                            calibre: presentacion.caliber,
                            pais: presentacion.country,
                            unidad: presentacion.measure_unit,
                            categoria: precio.category,
                            precioMinimoUnidad: precio.min_un,
                            precioMaximoUnidad: precio.max_un,
                            precioMinimoKg: precio.min_kg,
                            precioMaximoKg: precio.max_kg,
                            esReferencia: precio.is_reference,
                        });
                    }
                }
            }
        }
    }

    return { fechaRelevamiento: consulta.survey_date, filas };
}

export async function obtenerPreciosReferencia(): Promise<ResultadoPreciosReferencia> {
    const consulta = await obtenerConsultaPreciosReferencia();
    return convertirConsultaEnPreciosReferencia(consulta);
}
