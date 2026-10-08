import { describe, expect, it } from "vitest";
import {
    esFechaISO,
    fechaActualMontevideo,
    fechaHaceTresAnios,
    validarParametrosConsulta,
    type ConsultaHistorica,
} from "./parametros-consulta";

function consultaValida(): ConsultaHistorica {
    return { speciesId: 2, desde: "2025-10-06", hasta: "2026-10-06" };
}

describe("validarParametrosConsulta", () => {
    it("acepta una especie con identificador positivo y rangos de un solo día", () => {
        expect(() => validarParametrosConsulta(consultaValida())).not.toThrow();
        expect(() => validarParametrosConsulta({ ...consultaValida(), desde: "2026-10-06" })).not.toThrow();
    });

    it("rechaza una especie con identificador inválido", () => {
        for (const valor of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, "2", undefined]) {
            const consulta = Object.assign(consultaValida(), { speciesId: valor });
            expect(() => validarParametrosConsulta(consulta)).toThrow("speciesId");
        }
    });

    it.each(["desde", "hasta"] as const)("rechaza %s con fechas inexistentes o formato incorrecto", (campo) => {
        for (const valor of ["2026-02-29", "2026-04-31", "2026-1-06", "06/10/2026", "2026-10-06T00:00:00Z", "", undefined]) {
            const consulta = Object.assign(consultaValida(), { [campo]: valor });
            expect(() => validarParametrosConsulta(consulta)).toThrow(campo);
        }
    });

    it("rechaza un rango invertido antes de consultar el servicio", () => {
        expect(() => validarParametrosConsulta({ ...consultaValida(), desde: "2026-10-07" })).toThrow("posterior");
    });
});

describe("esFechaISO", () => {
    it.each(["2024-02-29", "2000-02-29", "2026-10-06", "2026-12-31"])("acepta la fecha real %s", (fecha) => {
        expect(esFechaISO(fecha)).toBe(true);
    });

    it.each(["1900-02-29", "2026-02-30", "2026-13-01", "2026-00-01", "2026-01-00", " 2026-10-06", null, 20261006])("rechaza %s", (fecha) => {
        expect(esFechaISO(fecha)).toBe(false);
    });
});

describe("fechas predeterminadas del histórico", () => {
    it("calcula hoy en Montevideo cuando la fecha UTC ya cambió", () => {
        expect(fechaActualMontevideo(new Date("2026-10-06T02:59:59.000Z"))).toBe("2026-10-05");
        expect(fechaActualMontevideo(new Date("2026-10-06T03:00:00.000Z"))).toBe("2026-10-06");
        expect(fechaActualMontevideo(new Date("2026-01-01T01:00:00.000Z"))).toBe("2025-12-31");
    });

    it.each([
        ["2026-10-06", "2023-10-06"],
        ["2024-02-29", "2021-02-28"],
        ["2000-02-29", "1997-02-28"],
        ["2027-02-28", "2024-02-28"],
        ["2026-01-01", "2023-01-01"],
    ])("calcula tres años antes de %s como %s", (fecha, anterior) => {
        expect(fechaHaceTresAnios(fecha)).toBe(anterior);
    });

    it("rechaza una fecha de origen imposible", () => {
        expect(() => fechaHaceTresAnios("2026-02-29")).toThrow("fecha real");
    });
});
