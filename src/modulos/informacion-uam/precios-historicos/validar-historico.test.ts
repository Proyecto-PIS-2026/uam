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
    ])("rechaza el campo raíz inválido %s con un error que identifica su ubicación", (ruta, valor) => {
        expect(() => validarHistoricoProducto(conCampo(ruta as string, valor)))
            .toThrow(`inválida en ${ruta}:`);
    });

    it.each([
        ["series[0]", null],
        ["series[0]", []],
        ["series[0].date", "2025-02-29"],
        ["series[0].date", undefined],
        ["series[0].presentations", {}],
        ["series[0].volume_kg", "1000"],
        ["series[0].volume_kg", Infinity],
        ["series[0].volume_kg", -1],
        ["series[0].presentations[0]", null],
        ["series[0].presentations[0].variety", 1],
        ["series[0].presentations[0].caliber", undefined],
        ["series[0].presentations[0].country", []],
        ["series[0].presentations[0].measure_unit", null],
        ["series[0].presentations[0].prices", "precios"],
        ["series[0].presentations[0].prices[0]", null],
        ["series[0].presentations[0].prices[0].category", {}],
        ["series[0].presentations[0].prices[0].min_kg", "70"],
        ["series[0].presentations[0].prices[0].min_kg", "Ñ"],
        ["series[0].presentations[0].prices[0].min_kg", -1],
        ["series[0].presentations[0].prices[0].max_kg", NaN],
        ["series[0].presentations[0].prices[0].min_un", null],
        ["series[0].presentations[0].prices[0].max_un", undefined],
        ["series[0].presentations[0].prices[0].is_reference", "true"],
    ])("descarta el registro con %s inválido e informa su ubicación", (ruta, valor) => {
        const recibido = conCampo(ruta as string, valor);
        const resultado = validarHistoricoProducto(recibido);

        expect(resultado.series.flatMap((dia) => dia.presentations.flatMap((presentacion) => presentacion.prices))).toEqual([]);
        expect(resultado.erroresValidacion).toHaveLength(1);
        expect(resultado.erroresValidacion![0]).toContain(`inválida en ${ruta}:`);
        expect(resultado.erroresValidacion![0]).toContain("Registro descartado (Banana;");
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

    it("conserva los precios cero y los textos vacíos admitidos por el servicio", () => {
        const recibido = conCampo("series[0].presentations[0].prices[0].min_kg", 0);
        recibido.series[0].presentations[0].prices[0].min_un = 0;
        recibido.series[0].presentations[0].variety = "";
        const original = JSON.parse(JSON.stringify(recibido)) as HistoricoProducto;

        expect(validarHistoricoProducto(recibido, {
            speciesId: 60, desde: historico.from, hasta: historico.to,
        })).toBe(recibido);
        expect(recibido).toStrictEqual(original);
    });

    it.each([
        ["min_kg", "max_kg"],
        ["min_un", "max_un"],
    ])("descarta los precios cuyo %s supera a %s", (minimo) => {
        const recibido = conCampo(`series[0].presentations[0].prices[0].${minimo}`, 100);
        const resultado = validarHistoricoProducto(recibido);

        expect(resultado.series[0].presentations).toEqual([]);
        expect(resultado.erroresValidacion![0]).toContain(`prices[0].${minimo}`);
        expect(resultado.erroresValidacion![0]).toContain("el mínimo (100) supera al máximo (75)");
        expect(resultado.erroresValidacion![0]).toContain("fecha: 2025-10-01");
    });

    it("conserva los precios, presentaciones y días válidos sin modificar la respuesta original", () => {
        const recibido = conCampo("series[0].presentations[0].prices[0].min_kg", "Ñ");
        const presentacionValida = structuredClone(historico.series[0].presentations[0]);
        const diaValido = structuredClone(historico.series[0]);
        diaValido.date = "2025-10-02";
        recibido.series[0].presentations[0].prices.push({ ...presentacionValida.prices[0], category: "II" });
        recibido.series[0].presentations.push(presentacionValida);
        recibido.series.push(diaValido);
        const original = structuredClone(recibido);

        const resultado = validarHistoricoProducto(recibido);

        expect(resultado.series).toHaveLength(2);
        expect(resultado.series[0].presentations).toHaveLength(2);
        expect(resultado.series[0].presentations[0].prices).toEqual([{ ...presentacionValida.prices[0], category: "II" }]);
        expect(resultado.series[0].presentations[1]).toEqual(presentacionValida);
        expect(resultado.series[1]).toEqual(diaValido);
        expect(resultado.erroresValidacion![0]).toContain('Valor recibido: "Ñ"');
        expect(resultado.erroresValidacion![0]).toContain("variedad: Cavendish; calibre: G; país: ECUADOR; unidad: KG");
        expect(recibido).toEqual(original);
    });

    it("descarta una presentación o un día inválidos sin perder los demás", () => {
        const recibido = conCampo("series[0].presentations[0].country", null);
        recibido.series[0].presentations.push(structuredClone(historico.series[0].presentations[0]));
        recibido.series.push({ ...structuredClone(historico.series[0]), date: "2025-02-30" });
        recibido.series.push({ ...structuredClone(historico.series[0]), date: "2025-10-02" });

        const resultado = validarHistoricoProducto(recibido);

        expect(resultado.series.map((dia) => dia.date)).toEqual(["2025-10-01", "2025-10-02"]);
        expect(resultado.series[0].presentations).toEqual(historico.series[0].presentations);
        expect(resultado.erroresValidacion).toHaveLength(2);
        expect(resultado.erroresValidacion![0]).toContain("presentations[0].country");
        expect(resultado.erroresValidacion![1]).toContain("series[1].date");
    });

    it("mantiene los errores al serializar y revalidar el histórico sin duplicarlos", () => {
        const resultado = validarHistoricoProducto(conCampo("series[0].presentations[0].prices[0].min_kg", "Ñ"));
        const desdeCache: unknown = JSON.parse(JSON.stringify(resultado));

        expect(validarHistoricoProducto(resultado)).toBe(resultado);
        expect(validarHistoricoProducto(desdeCache)).toEqual(resultado);
        expect(resultado.erroresValidacion).toHaveLength(1);
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
