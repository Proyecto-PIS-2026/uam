import { describe, expect, it } from "vitest";
import { validarConsultaPreciosReferencia } from "./validar-consulta-webservice";

function consultaValida() {
    return {
        survey_date: "2026-08-27",
        types: [
            {
                classification_id: 1,
                classification: "Hortalizas",
                products: [
                    {
                        species_id: 2,
                        species: "Acelga",
                        varieties: [
                            {
                                variety: "Común",
                                presentations: [
                                    {
                                        caliber: "XXL",
                                        country: "URUGUAY",
                                        measure_unit: "Cajón",
                                        prices: [
                                            {
                                                category: "Premium",
                                                min_kg: 12.5,
                                                max_kg: 18.75,
                                                min_un: 125,
                                                max_un: 180,
                                                is_reference: true,
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

describe("validarConsultaPreciosReferencia", () => {
    it("acepta la estructura del servicio y códigos que no existen en el TXT actual", () => {
        const consulta = consultaValida();
        expect(validarConsultaPreciosReferencia(consulta)).toBe(consulta);
    });

    it("rechaza una fecha imposible o una estructura incompleta", () => {
        expect(() => validarConsultaPreciosReferencia({ ...consultaValida(), survey_date: "2026-02-30" })).toThrow("survey_date");

        expect(() => validarConsultaPreciosReferencia({ ...consultaValida(), types: [] })).toThrow("types");

        const consulta = consultaValida();
        Object.assign(consulta.types[0].products[0].varieties[0], { presentations: null });
        expect(() => validarConsultaPreciosReferencia(consulta)).toThrow("presentations");
    });

    it("rechaza identificadores inválidos y nombres vacíos", () => {
        const idInvalido = consultaValida();
        idInvalido.types[0].classification_id = 0;
        expect(() => validarConsultaPreciosReferencia(idInvalido)).toThrow("classification_id");

        const nombreVacio = consultaValida();
        nombreVacio.types[0].products[0].species = "   ";
        expect(() => validarConsultaPreciosReferencia(nombreVacio)).toThrow("species");
    });

    it("rechaza precios no finitos, no positivos o con mínimo mayor al máximo", () => {
        const noFinito = consultaValida();
        noFinito.types[0].products[0].varieties[0].presentations[0].prices[0].min_kg = Infinity;
        expect(() => validarConsultaPreciosReferencia(noFinito)).toThrow("min_kg");

        const noPositivo = consultaValida();
        noPositivo.types[0].products[0].varieties[0].presentations[0].prices[0].max_un = 0;
        expect(() => validarConsultaPreciosReferencia(noPositivo)).toThrow("max_un");

        const rangoInvalido = consultaValida();
        rangoInvalido.types[0].products[0].varieties[0].presentations[0].prices[0].min_un = 181;
        expect(() => validarConsultaPreciosReferencia(rangoInvalido)).toThrow("mínimo supera al máximo");
    });

    it("exige que la marca de referencia sea booleana", () => {
        const consulta = consultaValida();
        Object.assign(consulta.types[0].products[0].varieties[0].presentations[0].prices[0], { is_reference: "true" });
        expect(() => validarConsultaPreciosReferencia(consulta)).toThrow("is_reference");
    });
});
