import { describe, expect, it } from "vitest";
import { formatearEmpaquetado } from "./empaquetado-publicacion";

describe("descripción del precio por empaquetado", () => {
    it.each([
        ["Cajon", "20", "Cajon (20 kg)"],
        ["Bolsa", "10-12", "Bolsa (10-12 kg)"],
        ["Plancha", null, "Plancha"],
        [null, "18-24", "18-24 kg"],
        [null, null, ""],
        ["-", "-", ""],
        ["  Bins ", " 400 ", "Bins (400 kg)"],
    ])("formatea envase %s y kilos %s", (envase, kilos, esperado) => {
        expect(formatearEmpaquetado(envase, kilos)).toBe(esperado);
    });
});
