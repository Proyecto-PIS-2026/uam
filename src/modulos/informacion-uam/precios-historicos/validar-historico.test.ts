import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ejemplo from "./historico-ejemplo.json";
import type { HistoricoProducto } from "./tipos";
import { validarHistoricoProducto } from "./validar-historico";

const historico: HistoricoProducto = {
    classification_id: 2, classification: "Exóticos/Importados", species_id: 60, species: "Banana",
    from: "2025-10-01", to: "2025-10-31",
    series: [{
        date: "2025-10-01", volume_kg: 1000,
        presentations: [{
            variety: "Cavendish", caliber: "G", country: "ECUADOR", measure_unit: "KG",
            prices: [{ category: "I", min_kg: 70, max_kg: 75, min_un: 70, max_un: 75, is_reference: true }],
        }],
    }],
};

function conCampo(ruta: string, valor: unknown): HistoricoProducto {
    const copia = structuredClone(historico);
    const campos = ruta.match(/[^.[\]]+/g)!;
    let registro = copia as unknown as Record<string, unknown>;
    for (const campo of campos.slice(0, -1)) registro = registro[campo] as Record<string, unknown>;
    registro[campos.at(-1)!] = valor;
    return copia;
}

beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe("validarHistoricoProducto", () => {
    it("acepta el histórico de ejemplo sin cambiar sus datos", () => {
        expect(validarHistoricoProducto(ejemplo)).toBe(ejemplo);
    });

    it.each([null, [], "histórico", 1, true, undefined])("rechaza una raíz que no sea un objeto: %s", (valor) => {
        expect(() => validarHistoricoProducto(valor)).toThrow("inválida en $");
    });

    it.each([
        ["species_id", undefined], ["species_id", NaN],
        ["from", "2025-02-30"], ["to", "31/10/2025"], ["series", null], ["series", {}],
    ])("rechaza una estructura no operable en %s sin sustituir los datos", (ruta, valor) => {
        const recibido = conCampo(ruta as string, valor);
        const original = structuredClone(recibido);
        expect(() => validarHistoricoProducto(recibido)).toThrow(`inválida en ${ruta}:`);
        expect(recibido).toStrictEqual(original);
    });

    it.each([
        ["classification_id", "2"], ["classification_id", Infinity], ["classification", null], ["species", { etiqueta: "Banana" }],
    ])("conserva el metadato informativo %s inesperado", (ruta, valor) => {
        const recibido = conCampo(ruta as string, valor);
        const original = structuredClone(recibido);
        expect(validarHistoricoProducto(recibido)).toBe(recibido);
        expect(recibido).toStrictEqual(original);
    });

    it("descarta sólo el precio mal estructurado y conserva sus hermanos sin mutar ni clonar los intactos", () => {
        const recibido = conCampo("series[0].presentations[0].prices[0]", null);
        const precioValido = structuredClone(historico.series[0].presentations[0].prices[0]);
        recibido.series[0].presentations[0].prices.push(precioValido);
        const otroDia = { ...structuredClone(historico.series[0]), date: "2025-10-02" };
        recibido.series.push(otroDia);
        const original = structuredClone(recibido);

        const resultado = validarHistoricoProducto(recibido);

        expect(resultado.series[0].presentations[0].prices).toEqual([precioValido]);
        expect(resultado.series[0].presentations[0].prices[0]).toBe(precioValido);
        expect(resultado.series[0].volume_kg).toBe(1000);
        expect(resultado.series[1]).toBe(otroDia);
        expect(resultado.series[0]).not.toBe(recibido.series[0]);
        expect(resultado).not.toHaveProperty("erroresValidacion");
        expect(recibido).toStrictEqual(original);
    });

    it.each([null, "sin precios"])("descarta sólo la presentación mal estructurada (%s) y conserva las otras", (precios) => {
        const recibido = conCampo("series[0].presentations[0].prices", precios);
        const valida = structuredClone(historico.series[0].presentations[0]);
        recibido.series[0].presentations.push(valida);
        const original = structuredClone(recibido);

        const resultado = validarHistoricoProducto(recibido);

        expect(resultado.series[0].presentations).toEqual([valida]);
        expect(resultado.series[0].presentations[0]).toBe(valida);
        expect(resultado.series[0].volume_kg).toBe(1000);
        expect(recibido).toStrictEqual(original);
    });

    it.each([null, { date: "2025-10-01", presentations: "sin presentaciones" }])("descarta sólo el día imposible (%j) si hay otros procesables", (dia) => {
        const recibido = conCampo("series[0]", dia);
        const valido = structuredClone(historico.series[0]);
        recibido.series.push(valido);
        const original = structuredClone(recibido);

        const resultado = validarHistoricoProducto(recibido);

        expect(resultado.series).toEqual([valido]);
        expect(resultado.series[0]).toBe(valido);
        expect(recibido).toStrictEqual(original);
    });

    it.each(["date", "presentations[0].variety", "presentations[0].prices[0].min_kg"])("descarta el menor elemento cuando falta la clave requerida %s", (ruta) => {
        const recibido = structuredClone(historico);
        recibido.series.push({ ...structuredClone(historico.series[0]), date: "2025-10-02" });
        const campos = `series[0].${ruta}`.match(/[^.[\]]+/g)!;
        let registro = recibido as unknown as Record<string, unknown>;
        for (const campo of campos.slice(0, -1)) registro = registro[campo] as Record<string, unknown>;
        delete registro[campos.at(-1)!];
        const original = structuredClone(recibido);

        const resultado = validarHistoricoProducto(recibido);

        expect(resultado.series.at(-1)).toBe(recibido.series[1]);
        if (ruta === "date") expect(resultado.series).toHaveLength(1);
        else if (ruta.includes("prices")) expect(resultado.series[0].presentations[0].prices).toEqual([]);
        else expect(resultado.series[0].presentations).toEqual([]);
        expect(recibido).toStrictEqual(original);
    });

    it("mantiene el día, la presentación y el volumen cuando sólo el precio debe descartarse", () => {
        const recibido = conCampo("series[0].presentations[0].prices[0]", null);

        const resultado = validarHistoricoProducto(recibido);

        expect(resultado.series).toHaveLength(1);
        expect(resultado.series[0].volume_kg).toBe(1000);
        expect(resultado.series[0].presentations).toHaveLength(1);
        expect(resultado.series[0].presentations[0].prices).toEqual([]);
    });

    it("rechaza la respuesta cuando no queda ningún día con estructura procesable", () => {
        const recibido = conCampo("series", [null, { date: "2025-10-01", presentations: "no es una lista" }]);
        const original = structuredClone(recibido);

        expect(() => validarHistoricoProducto(recibido)).toThrow("no contiene días con una estructura procesable");
        expect(recibido).toStrictEqual(original);
    });

    it("acepta una serie vacía legítima conservando la identidad del documento", () => {
        const recibido = conCampo("series", []);
        expect(validarHistoricoProducto(recibido)).toBe(recibido);
    });

    it.each([
        ["series[0].presentations[0].prices[0].min_kg", "Ñ"],
        ["series[0].presentations[0].prices[0].min_kg", "70"],
        ["series[0].presentations[0].prices[0].min_kg", "Infinity"],
        ["series[0].presentations[0].prices[0].min_kg", false],
        ["series[0].presentations[0].prices[0].min_kg", { valor: "Ñ" }],
        ["series[0].presentations[0].prices[0].min_kg", ["Ñ", null]],
        ["series[0].presentations[0].prices[0].min_kg", -1],
        ["series[0].presentations[0].prices[0].max_kg", Infinity],
        ["series[0].presentations[0].prices[0].max_kg", NaN],
        ["series[0].presentations[0].prices[0].min_un", null],
        ["series[0].presentations[0].prices[0].max_un", undefined],
        ["series[0].presentations[0].prices[0].is_reference", "true"],
        ["series[0].presentations[0].prices[0].is_reference", null],
        ["series[0].presentations[0].prices[0].category", {}],
        ["series[0].presentations[0].prices[0].category", ["I", "II"]],
        ["series[0].presentations[0].variety", null],
        ["series[0].presentations[0].variety", { nombre: "Ñ" }],
        ["series[0].presentations[0].caliber", 10],
        ["series[0].presentations[0].country", []],
        ["series[0].presentations[0].measure_unit", false],
        ["series[0].volume_kg", "Ñ"], ["series[0].volume_kg", -1], ["series[0].volume_kg", Infinity],
        ["series[0].date", "2025-02-30"],
        ["series[0].date", undefined], ["series[0].date", null], ["series[0].date", false],
        ["series[0].date", 1], ["series[0].date", { fecha: "2025-10-01" }], ["series[0].date", ["2025-10-01"]],
    ])("conserva cada registro y valor inesperado recibido en %s", (ruta, valor) => {
        const recibido = conCampo(ruta as string, valor);
        const original = structuredClone(recibido);
        const resultado = validarHistoricoProducto(recibido);
        expect(resultado).toBe(recibido);
        expect(resultado).toStrictEqual(original);
        expect(resultado).not.toHaveProperty("erroresValidacion");
    });

    it.each([["min_kg", "max_kg"], ["min_un", "max_un"]])("conserva %s mayor que %s sin invertir ni descartar el precio", (minimo) => {
        const recibido = conCampo(`series[0].presentations[0].prices[0].${minimo}`, 100);
        const original = structuredClone(recibido);
        expect(validarHistoricoProducto(recibido)).toBe(recibido);
        expect(recibido).toStrictEqual(original);
    });

    it.each([undefined, null, 0])("conserva el volumen opcional %s", (volumen) => {
        const recibido = conCampo("series[0].volume_kg", volumen);
        expect(validarHistoricoProducto(recibido)).toBe(recibido);
    });

    it("conserva Ñ y mínimos mayores que máximos, descarta sólo el precio sin estructura y no registra logs", () => {
        const recibido = conCampo("series[0].presentations[0].prices[0]", null);
        const valorCrudo = { ...historico.series[0].presentations[0].prices[0], min_kg: "Ñ" };
        const contradictorio = { ...historico.series[0].presentations[0].prices[0], category: "II", min_kg: 100, max_kg: 75 };
        recibido.series[0].presentations[0].prices.push(valorCrudo, contradictorio);
        const original = structuredClone(recibido);

        const resultado = validarHistoricoProducto(recibido);

        expect(resultado.series[0].presentations[0].prices).toEqual([valorCrudo, contradictorio]);
        expect(resultado.series[0].volume_kg).toBe(1000);
        expect(recibido).toStrictEqual(original);
        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("elimina sólo la metadata pública heredada sin modificar los precios ni el original", () => {
        const recibido = { ...conCampo("series[0].presentations[0].prices[0].min_kg", "Ñ"), erroresValidacion: ["Diagnóstico heredado"] };
        const original = structuredClone(recibido);
        const resultado = validarHistoricoProducto(recibido);
        expect(resultado).not.toHaveProperty("erroresValidacion");
        expect(resultado.series).toBe(recibido.series);
        expect(recibido).toStrictEqual(original);
    });

    it("rechaza una especie que no coincide con la consulta", () => {
        expect(() => validarHistoricoProducto(conCampo("species_id", 61), {
            speciesId: 60, desde: historico.from, hasta: historico.to,
        })).toThrow("inválida en species_id:");
    });

    it("conserva clasificación y límites del servicio aunque difieran de la consulta", () => {
        const recibido = conCampo("classification_id", 3);
        recibido.from = "2025-09-30";
        recibido.to = "2025-11-01";
        expect(validarHistoricoProducto(recibido, { speciesId: 60, desde: historico.from, hasta: historico.to })).toBe(recibido);
    });
});
