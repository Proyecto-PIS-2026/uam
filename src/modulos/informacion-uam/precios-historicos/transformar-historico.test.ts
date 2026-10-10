import { describe, expect, it } from "vitest";
import type { HistoricoProducto, PrecioHistorico, PresentacionHistorica, RegistroHistorico } from "./tipos";
import { filtrarHistorico, fusionarHistoricos } from "./transformar-historico";

function precio(category = "I", valor = 70): PrecioHistorico {
    return { category, min_kg: valor, max_kg: valor + 5, min_un: valor, max_un: valor + 5, is_reference: true };
}

function presentacion(campos: Partial<PresentacionHistorica> = {}): PresentacionHistorica {
    return {
        variety: "Cavendish", caliber: "G", country: "ECUADOR", measure_unit: "KG",
        prices: [precio()], ...campos,
    };
}

function historico(series: RegistroHistorico[], campos: Partial<HistoricoProducto> = {}): HistoricoProducto {
    return {
        classification_id: 2,
        classification: "Importados",
        species_id: 60,
        species: "Banana",
        from: "2026-10-01",
        to: "2026-10-09",
        series,
        ...campos,
    };
}

const consulta = { speciesId: 60, desde: "2026-10-02", hasta: "2026-10-08" };

describe("fusionarHistoricos", () => {
    it("agrega fechas nuevas, ordena y extiende la cobertura sin duplicar el día de solapamiento", () => {
        const guardado = historico([
            { date: "2026-10-04", volume_kg: 100, presentations: [presentacion()] },
            { date: "2026-10-02", presentations: [presentacion()] },
        ], { from: "2026-10-02", to: "2026-10-04" });
        const recibido = historico([
            { date: "2026-10-06", presentations: [presentacion()] },
            { date: "2026-10-04", volume_kg: 200, presentations: [presentacion({ prices: [precio("I", 900)] })] },
            { date: "2026-10-01", presentations: [] },
        ]);

        const resultado = fusionarHistoricos(guardado, recibido);

        expect(resultado.from).toBe("2026-10-01");
        expect(resultado.to).toBe("2026-10-09");
        expect(resultado.series.map((dia) => dia.date)).toEqual([
            "2026-10-01", "2026-10-02", "2026-10-04", "2026-10-06",
        ]);
        expect(resultado.series[2]).toEqual(guardado.series[0]);
    });

    it("completa un día vacío y agrega presentaciones y categorías manteniendo los precios existentes", () => {
        const guardado = historico([
            { date: "2026-10-07", presentations: [] },
            { date: "2026-10-08", presentations: [presentacion()] },
        ]);
        const recibido = historico([
            { date: "2026-10-07", volume_kg: 500, presentations: [presentacion()] },
            { date: "2026-10-08", presentations: [
                presentacion({ prices: [precio("I", 999), precio("II", 50)] }),
                presentacion({ caliber: "M" }),
                presentacion({ variety: "Otra" }),
                presentacion({ country: "BRASIL" }),
                presentacion({ measure_unit: "CAJÓN" }),
            ] },
        ]);

        const resultado = fusionarHistoricos(guardado, recibido);

        expect(resultado.series[0]).toEqual(recibido.series[0]);
        expect(resultado.series[1].presentations).toHaveLength(5);
        expect(resultado.series[1].presentations[0].prices).toEqual([precio(), precio("II", 50)]);
        expect(fusionarHistoricos(resultado, recibido)).toStrictEqual(resultado);
    });

    it("deduplica fechas, presentaciones y categorías incluso si vienen repetidas en una respuesta", () => {
        const recibido = historico([
            { date: "2026-10-08", presentations: [
                presentacion({ prices: [precio(), precio("I", 800)] }),
                presentacion({ prices: [precio("II"), precio("II", 900)] }),
            ] },
            { date: "2026-10-08", presentations: [presentacion()] },
        ]);

        const resultado = fusionarHistoricos(historico([]), recibido);

        expect(resultado.series).toHaveLength(1);
        expect(resultado.series[0].presentations).toHaveLength(1);
        expect(resultado.series[0].presentations[0].prices).toEqual([precio(), precio("II")]);
        expect(fusionarHistoricos(resultado, recibido)).toStrictEqual(resultado);
    });

    it.each([undefined, null])("completa volumen ausente (%s) sin perder el resto del registro", (volume_kg) => {
        const guardado = historico([{ date: "2026-10-08", volume_kg, presentations: [] }]);
        const recibido = historico([{ date: "2026-10-08", volume_kg: 300, presentations: [] }]);

        expect(fusionarHistoricos(guardado, recibido).series[0].volume_kg).toBe(300);
    });

    it.each([0, 300])("conserva el volumen existente (%s) aunque la actualización traiga otro", (volume_kg) => {
        const guardado = historico([{ date: "2026-10-08", volume_kg, presentations: [] }]);
        const recibido = historico([{ date: "2026-10-08", volume_kg: 999, presentations: [] }]);

        expect(fusionarHistoricos(guardado, recibido).series[0].volume_kg).toBe(volume_kg);
    });

    it("conserva días sin datos y volúmenes nulos cuando no hay información para completarlos", () => {
        const guardado = historico([{ date: "2026-10-08", volume_kg: null, presentations: [] }]);
        const recibido = historico([{ date: "2026-10-09", presentations: [] }]);

        expect(fusionarHistoricos(guardado, recibido).series).toEqual([
            ...guardado.series, ...recibido.series,
        ]);
    });

    it("no modifica ni comparte objetos de las entradas", () => {
        const guardado = historico([{ date: "2026-10-02", presentations: [presentacion()] }]);
        const recibido = historico([{ date: "2026-10-08", presentations: [presentacion()] }]);
        const original = structuredClone({ guardado, recibido });

        const resultado = fusionarHistoricos(guardado, recibido);
        expect({ guardado, recibido }).toStrictEqual(original);
        resultado.series[0].presentations[0].prices[0].min_kg = -1;
        resultado.series[1].presentations[0].variety = "Modificada";
        expect({ guardado, recibido }).toStrictEqual(original);
    });

    it("rechaza la mezcla de distintas especies", () => {
        expect(() => fusionarHistoricos(historico([]), historico([], { species_id: 61 })))
            .toThrow("distintas especies");
    });
});

describe("filtrarHistorico", () => {
    it("incluye ambos extremos y conserva días vacíos y volumen cuando no hay filtros de producto", () => {
        const guardado = historico([
            { date: "2026-10-01", presentations: [presentacion()] },
            { date: "2026-10-02", volume_kg: 100, presentations: [] },
            { date: "2026-10-04", volume_kg: null, presentations: [] },
            { date: "2026-10-08", presentations: [presentacion()] },
            { date: "2026-10-09", presentations: [presentacion()] },
        ]);

        const resultado = filtrarHistorico(guardado, consulta);

        expect(resultado.from).toBe(consulta.desde);
        expect(resultado.to).toBe(consulta.hasta);
        expect(resultado.series).toEqual(guardado.series.slice(1, 4));
    });

    it("aplica variedad, país, calibre y categoría conjuntamente sin devolver precios o días ajenos", () => {
        const guardado = historico([
            { date: "2026-10-02", volume_kg: 100, presentations: [
                presentacion({ prices: [precio(), precio("II", 50)] }),
                presentacion({ variety: "Otra" }),
                presentacion({ caliber: "M" }),
                presentacion({ country: "BRASIL" }),
            ] },
            { date: "2026-10-03", presentations: [presentacion({ prices: [precio("II")] })] },
            { date: "2026-10-04", presentations: [] },
            { date: "2026-10-05", presentations: [presentacion({ prices: [] })] },
        ]);

        const resultado = filtrarHistorico(guardado, consulta, {
            variedad: "Cavendish", pais: "ECUADOR", calibre: "G", categoria: "I",
        });

        expect(resultado.series).toEqual([
            { date: "2026-10-02", volume_kg: 100, presentations: [presentacion()] },
        ]);
    });

    it("considera los filtros vacíos como valores exactos y no hace coincidencias parciales", () => {
        const guardado = historico([{ date: "2026-10-02", presentations: [
            presentacion({ variety: "" }), presentacion(),
        ] }]);

        expect(filtrarHistorico(guardado, consulta, { variedad: "" }).series[0].presentations)
            .toEqual([presentacion({ variety: "" })]);
        expect(filtrarHistorico(guardado, consulta, { variedad: "Caven" }).series).toEqual([]);
    });

    it("retorna una serie vacía con los límites solicitados cuando no hay coincidencias", () => {
        const guardado = historico([{ date: "2026-10-09", presentations: [presentacion()] }]);

        expect(filtrarHistorico(guardado, consulta)).toEqual({
            ...guardado, from: consulta.desde, to: consulta.hasta, series: [],
        });
    });

    it.each([{}, { categoria: "I" }])("no modifica ni comparte los datos originales al filtrar con %j", (filtros) => {
        const guardado = historico([{ date: "2026-10-02", presentations: [presentacion()] }]);
        const original = structuredClone(guardado);

        const resultado = filtrarHistorico(guardado, consulta, filtros);
        expect(guardado).toStrictEqual(original);
        resultado.series[0].presentations[0].prices[0].min_kg = -1;
        expect(guardado).toStrictEqual(original);
    });

    it("rechaza una especie distinta o un intervalo inválido", () => {
        expect(() => filtrarHistorico(historico([]), { ...consulta, speciesId: 61 })).toThrow("especie");
        expect(() => filtrarHistorico(historico([]), { ...consulta, desde: "2026-10-09" })).toThrow("posterior");
    });
});
