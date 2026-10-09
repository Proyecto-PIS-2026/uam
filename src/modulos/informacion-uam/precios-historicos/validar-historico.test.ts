import { describe, expect, it } from "vitest";
import ejemplo from "./historico-ejemplo.json";
import type { HistoricoProducto } from "./tipos";
import { validarHistoricoProducto } from "./validar-historico";

const historico: HistoricoProducto = {
    classification_id: 2,
    classification: "Exóticos/Importados",
    species_id: 60,
    species: "Banana",
    from: "2025-10-01",
    to: "2025-10-31",
    series: [{
        date: "2025-10-01",
        volume_kg: 1000,
        presentations: [{
            variety: "Cavendish", caliber: "G", country: "ECUADOR", measure_unit: "KG",
            prices: [{ category: "I", min_kg: 70, max_kg: 75, min_un: 70, max_un: 75, is_reference: true }],
        }],
    }],
};

function conCampo(ruta: string, valor: unknown): HistoricoProducto {
    const copia = JSON.parse(JSON.stringify(historico)) as HistoricoProducto;
    const campos = ruta.match(/[^.[\]]+/g)!;
    let registro = copia as unknown as Record<string, unknown>;
    for (const campo of campos.slice(0, -1)) registro = registro[campo] as Record<string, unknown>;
    registro[campos.at(-1)!] = valor;
    return copia;
}

describe("validarHistoricoProducto", () => {
    it("acepta el histórico completo de ejemplo sin cambiar los datos", () => {
        expect(validarHistoricoProducto(ejemplo)).toBe(ejemplo);
    });

    it.each([null, [], "histórico", 1, true, undefined])("rechaza una raíz que no sea un objeto: %s", (valor) => {
        expect(() => validarHistoricoProducto(valor)).toThrow("inválida en $");
    });

    it.each([
        ["classification_id", "2"],
        ["classification_id", Infinity],
        ["classification", null],
        ["species_id", undefined],
        ["species_id", NaN],
        ["species", {}],
        ["from", "2025-02-30"],
        ["to", "31/10/2025"],
        ["series", null],
        ["series", {}],
        ["series[0]", null],
        ["series[0]", []],
        ["series[0].date", "2025-02-29"],
        ["series[0].date", undefined],
        ["series[0].presentations", {}],
        ["series[0].volume_kg", "1000"],
        ["series[0].volume_kg", Infinity],
        ["series[0].presentations[0]", null],
        ["series[0].presentations[0].variety", 1],
        ["series[0].presentations[0].caliber", undefined],
        ["series[0].presentations[0].country", []],
        ["series[0].presentations[0].measure_unit", null],
        ["series[0].presentations[0].prices", "precios"],
        ["series[0].presentations[0].prices[0]", null],
        ["series[0].presentations[0].prices[0].category", {}],
        ["series[0].presentations[0].prices[0].min_kg", "70"],
        ["series[0].presentations[0].prices[0].max_kg", NaN],
        ["series[0].presentations[0].prices[0].min_un", null],
        ["series[0].presentations[0].prices[0].max_un", undefined],
        ["series[0].presentations[0].prices[0].is_reference", "true"],
    ])("rechaza el campo inválido %s con un error que identifica su ubicación", (ruta, valor) => {
        expect(() => validarHistoricoProducto(conCampo(ruta as string, valor)))
            .toThrow(`inválida en ${ruta}:`);
    });

    it.each([
        ["series", []],
        ["series[0].presentations", []],
        ["series[0].presentations[0].prices", []],
        ["series[0].volume_kg", undefined],
        ["series[0].volume_kg", null],
        ["series[0].volume_kg", 0],
    ])("acepta un histórico sin datos opcionales en %s", (ruta, valor) => {
        const recibido = conCampo(ruta as string, valor);
        expect(validarHistoricoProducto(recibido)).toBe(recibido);
    });

    it("conserva valores del servicio sin imponer relaciones de negocio entre ellos", () => {
        const recibido = conCampo("series[0].presentations[0].prices[0].min_kg", 100);
        recibido.series[0].presentations[0].prices[0].min_un = 0;
        recibido.series[0].presentations[0].variety = "";
        const original = JSON.parse(JSON.stringify(recibido)) as HistoricoProducto;

        expect(validarHistoricoProducto(recibido, {
            speciesId: 60, desde: historico.from, hasta: historico.to,
        })).toBe(recibido);
        expect(recibido).toStrictEqual(original);
    });

    it("rechaza una especie que no coincide con la consulta", () => {
        const recibido = conCampo("species_id", 61);

        expect(() => validarHistoricoProducto(recibido, {
            speciesId: 60, desde: historico.from, hasta: historico.to,
        })).toThrow("inválida en species_id:");
    });

    it("acepta la clasificación del servicio como metadato sin exigirla en la consulta", () => {
        const recibido = conCampo("classification_id", 3);

        expect(validarHistoricoProducto(recibido, {
            speciesId: 60, desde: historico.from, hasta: historico.to,
        })).toBe(recibido);
    });

    it("preserva el período devuelto por el servicio aunque difiera del solicitado", () => {
        const recibido = conCampo("from", "2025-09-30");
        recibido.to = "2025-11-01";

        expect(validarHistoricoProducto(recibido, {
            speciesId: 60, desde: historico.from, hasta: historico.to,
        })).toBe(recibido);
    });
});
