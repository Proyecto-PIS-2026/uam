import { describe, expect, it } from "vitest";
import { normalizarDepartamento, obtenerDepartamentos } from "./departamentos-uruguay";

describe("departamentos de Uruguay", () => {
    it.each([
        ["Departamento de Paysandu", "Paysandú"], ["San Jose Department", "San José"],
        ["  RIO   NEGRO  ", "Río Negro"], ["Tacuarembo", "Tacuarembó"],
        ["Montevideo", "Montevideo"], ["Departamento de Treinta y Tres", "Treinta y Tres"],
    ])("normaliza %s", (entrada, esperado) => {
        expect(normalizarDepartamento(entrada)).toBe(esperado);
    });

    it.each([null, undefined, "", "Buenos Aires", "Ciudad de la Costa", "Quinta en Salto", 12])(
        "no inventa un departamento a partir de %s", (entrada) => {
            expect(normalizarDepartamento(entrada)).toBeNull();
        },
    );

    it("agrupa y ordena departamentos sin contar ubicaciones pendientes de identificar", () => {
        expect(obtenerDepartamentos([
            { departamento: "salto" }, { departamento: "Canelones" }, { departamento: "Departamento de Salto" },
            {}, { departamento: null }, { departamento: "Quinta en Rocha" },
        ])).toEqual(["Canelones", "Salto"]);
    });
});
