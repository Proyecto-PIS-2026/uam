import { describe, expect, it } from "vitest";
import type { ConsultaHistorica } from "./parametros-consulta";
import { dividirPeriodoHistorico } from "./periodos-historicos";

function consulta(desde: string, hasta: string): ConsultaHistorica {
    return { speciesId: 10, desde, hasta };
}

describe("dividirPeriodoHistorico", () => {
    it.each([
        ["2026-10-09", "2026-10-09"],
        ["2026-10-01", "2026-10-09"],
        ["2023-10-09", "2026-10-09"],
        ["2024-02-29", "2027-02-28"],
        ["0000-01-01", "0002-12-31"],
        ["9997-01-01", "9999-12-31"],
    ])("mantiene en un solo pedido el período de %s a %s", (desde, hasta) => {
        const original = consulta(desde, hasta);
        expect(dividirPeriodoHistorico(original)).toEqual([original]);
    });

    it("conserva los tres tramos de la importación inicial de nueve años", () => {
        const original = consulta("2017-10-09", "2026-10-09");
        const copia = { ...original };

        expect(dividirPeriodoHistorico(original)).toEqual([
            consulta("2017-10-09", "2020-10-09"),
            consulta("2020-10-10", "2023-10-09"),
            consulta("2023-10-10", "2026-10-09"),
        ]);
        expect(original).toEqual(copia);
    });

    it("divide un período que excede tres años por el día bisiesto del extremo final", () => {
        expect(dividirPeriodoHistorico(consulta("2021-02-28", "2024-02-29"))).toEqual([
            consulta("2021-02-28", "2021-02-28"),
            consulta("2021-03-01", "2024-02-29"),
        ]);
    });

    it("conserva los nueve años completos al terminar un 29 de febrero", () => {
        expect(dividirPeriodoHistorico(consulta("2015-02-28", "2024-02-29"))).toEqual([
            consulta("2015-02-28", "2018-02-28"),
            consulta("2018-03-01", "2021-02-28"),
            consulta("2021-03-01", "2024-02-29"),
        ]);
    });

    it.each([
        ["2010-01-01", "2026-10-09"],
        ["1997-02-28", "2000-02-29"],
        ["1897-02-28", "1900-03-01"],
        ["0000-02-29", "0003-03-01"],
        ["0000-01-01", "9999-12-31"],
    ])("cubre %s a %s con bloques contiguos de hasta tres años", (desde, hasta) => {
        const periodos = dividirPeriodoHistorico(consulta(desde, hasta));
        expect(periodos[0].desde).toBe(desde);
        expect(periodos.at(-1)?.hasta).toBe(hasta);

        for (const [indice, periodo] of periodos.entries()) {
            const inicio = new Date(`${periodo.desde}T00:00:00.000Z`);
            const fin = new Date(`${periodo.hasta}T00:00:00.000Z`);
            const limite = new Date(inicio.getTime());
            limite.setUTCFullYear(inicio.getUTCFullYear() + 3);
            if (limite.getUTCMonth() !== inicio.getUTCMonth()) limite.setUTCDate(0);

            expect(periodo.speciesId).toBe(10);
            expect(fin.getTime()).toBeGreaterThanOrEqual(inicio.getTime());
            expect(fin.getTime()).toBeLessThanOrEqual(limite.getTime());
            expect(inicio.toISOString().slice(0, 10)).toBe(periodo.desde);
            expect(fin.toISOString().slice(0, 10)).toBe(periodo.hasta);
            if (indice > 0) {
                const finAnterior = Date.parse(`${periodos[indice - 1].hasta}T00:00:00.000Z`);
                expect(inicio.getTime() - finAnterior).toBe(86_400_000);
            }
        }
    });

    it.each([
        { speciesId: 0, desde: "2020-01-01", hasta: "2026-10-09" },
        consulta("2023-02-29", "2026-10-09"),
        consulta("2026-10-09", "2020-01-01"),
        consulta("2020-01-01", "10000-01-01"),
    ])("rechaza los parámetros inválidos antes de dividir: %j", (invalida) => {
        expect(() => dividirPeriodoHistorico(invalida)).toThrow();
    });
});
