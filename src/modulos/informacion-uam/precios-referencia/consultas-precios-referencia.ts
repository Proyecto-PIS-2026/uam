import { autorizado } from "../../identidad-acceso/autorizacion/permisos";
import { textoValorWebservice, type ValorWebservice } from "../valores-webservice";

export type ConsultaPreciosReferencia = {
    survey_date: string;
    types: {
        classification_id: ValorWebservice;
        classification: ValorWebservice;
        products: {
            species_id: number;
            species: ValorWebservice;
            varieties: {
                variety: ValorWebservice;
                presentations: {
                    caliber: ValorWebservice;
                    country: ValorWebservice;
                    measure_unit: ValorWebservice;
                    prices: { category: ValorWebservice; min_kg: ValorWebservice; max_kg: ValorWebservice; min_un: ValorWebservice; max_un: ValorWebservice; is_reference: ValorWebservice }[];
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
    precioMinimoUnidad: ValorWebservice;
    precioMaximoUnidad: ValorWebservice;
    precioMinimoKg: ValorWebservice;
    precioMaximoKg: ValorWebservice;
    esReferencia: ValorWebservice;
};

export type ResultadoPreciosReferencia = { fechaRelevamiento: string; filas: PrecioReferencia[] };

export async function obtenerConsultaPreciosReferencia(): Promise<ConsultaPreciosReferencia> {
    if (!autorizado("preciosReferencia.consultar")) {
        throw new Error("No tiene permisos para consultar precios de referencia.");
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
                            especie: textoValorWebservice(producto.species),
                            variedad: textoValorWebservice(variedad.variety),
                            calibre: textoValorWebservice(presentacion.caliber),
                            pais: textoValorWebservice(presentacion.country),
                            unidad: textoValorWebservice(presentacion.measure_unit),
                            categoria: textoValorWebservice(precio.category),
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
