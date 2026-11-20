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

    it("rechaza una fecha imposible o una raíz que no pueda recorrerse", () => {
        expect(() => validarConsultaPreciosReferencia({ ...consultaValida(), survey_date: "2026-02-30" })).toThrow("survey_date");
        expect(() => validarConsultaPreciosReferencia({ ...consultaValida(), types: null })).toThrow("types");
        expect(() => validarConsultaPreciosReferencia({ ...consultaValida(), types: [null] })).toThrow("types");
    });

    it.each([null, [], "relevamiento", 1, true, undefined])("rechaza una raíz que no sea un objeto: %s", (valor) => {
        expect(() => validarConsultaPreciosReferencia(valor)).toThrow("inválida en $");
    });

    it("acepta un relevamiento vacío como el histórico", () => {
        const consulta = { ...consultaValida(), types: [] };
        expect(validarConsultaPreciosReferencia(consulta)).toBe(consulta);
    });

    it("conserva los rangos invertidos de Ajo recibidos de producción sin alterarlos", () => {
        const consulta = consultaValida();
        consulta.types[0].products[0].species = "Ajo";
        Object.assign(consulta.types[0].products[0].varieties[0].presentations[0].prices[0], {
            category: "II", min_kg: 1600, max_kg: 200, min_un: 80, max_un: 10, is_reference: false,
        });
        const original = structuredClone(consulta);

        expect(validarConsultaPreciosReferencia(consulta)).toBe(consulta);
        expect(consulta).toStrictEqual(original);
    });

    it.each([0, -10, "Ñ", "12.50", null, false, { valor: 12 }, [10, 20], Infinity, NaN])(
        "conserva los valores de precio recibidos sin convertirlos: %j", (valor) => {
            const consulta = consultaValida();
            Object.assign(consulta.types[0].products[0].varieties[0].presentations[0].prices[0], {
                min_kg: valor, max_kg: valor, min_un: valor, max_un: valor,
            });
            const original = structuredClone(consulta);
            expect(validarConsultaPreciosReferencia(consulta)).toBe(consulta);
            expect(consulta).toStrictEqual(original);
        },
    );

    it("conserva atributos y marcas de referencia inesperados como el histórico", () => {
        const consulta = consultaValida();
        Object.assign(consulta.types[0], { classification_id: "1", classification: null });
        Object.assign(consulta.types[0].products[0], { species: { nombre: "Ajo" } });
        Object.assign(consulta.types[0].products[0].varieties[0], { variety: "   " });
        Object.assign(consulta.types[0].products[0].varieties[0].presentations[0], { caliber: 0, country: null, measure_unit: false });
        Object.assign(consulta.types[0].products[0].varieties[0].presentations[0].prices[0], { category: ["I", "II"], is_reference: "false" });
        const original = structuredClone(consulta);

        expect(validarConsultaPreciosReferencia(consulta)).toBe(consulta);
        expect(consulta).toStrictEqual(original);
    });

    it("descarta únicamente bandas sin estructura o campos requeridos, conservando sus hermanas", () => {
        const consulta = consultaValida();
        const presentacion = consulta.types[0].products[0].varieties[0].presentations[0];
        const valida = presentacion.prices[0];
        const incompleta: Record<string, unknown> = { ...valida };
        delete incompleta.min_kg;
        Object.assign(presentacion, { prices: [null, incompleta, valida] });
        const original = structuredClone(consulta);

        const resultado = validarConsultaPreciosReferencia(consulta);

        expect(resultado.types[0].products[0].varieties[0].presentations[0].prices).toEqual([valida]);
        expect(resultado.types[0].products[0].varieties[0].presentations[0].prices[0]).toBe(valida);
        expect(consulta).toStrictEqual(original);
    });

    it.each(["products", "varieties", "presentations", "prices"])("descarta el nodo con %s no procesable sin perder los demás", (campo) => {
        const consulta = consultaValida();
        const tipo = consulta.types[0];
        const producto = tipo.products[0];
        const variedad = producto.varieties[0];
        const presentacion = variedad.presentations[0];
        if (campo === "products") consulta.types.unshift({ ...tipo, products: null } as unknown as typeof tipo);
        if (campo === "varieties") tipo.products.unshift({ ...producto, varieties: null } as unknown as typeof producto);
        if (campo === "presentations") producto.varieties.unshift({ ...variedad, presentations: null } as unknown as typeof variedad);
        if (campo === "prices") variedad.presentations.unshift({ ...presentacion, prices: null } as unknown as typeof presentacion);
        const original = structuredClone(consulta);

        expect(validarConsultaPreciosReferencia(consulta)).toStrictEqual(consultaValida());
        expect(consulta).toStrictEqual(original);
    });

    it("mantiene los contenedores vacíos al descartar todas sus bandas, sin inventar precios", () => {
        const consulta = consultaValida();
        Object.assign(consulta.types[0].products[0].varieties[0].presentations[0], { prices: [null] });
        expect(validarConsultaPreciosReferencia(consulta).types[0].products[0].varieties[0].presentations[0].prices).toEqual([]);
    });

    it("descarta solamente el producto sin identificador operable", () => {
        const consulta = consultaValida();
        const valido = consulta.types[0].products[0];
        consulta.types[0].products.unshift({ ...valido, species_id: NaN });
        expect(validarConsultaPreciosReferencia(consulta).types[0].products).toEqual([valido]);
    });
});
