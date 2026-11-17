import { describe, expect, it } from "vitest";
import { validarUbicacionesProductor } from "./ubicaciones-productor";

const punto = { nombreUbicacion: " Quinta ", urlMaps: "https://www.google.com/maps?q=-34.5,-56.1" };

describe("departamento de las ubicaciones de productores", () => {
    it("conserva y normaliza el departamento obtenido del mapa", () => {
        expect(validarUbicacionesProductor([{ ...punto, departamento: "Departamento de San Jose" }])).toEqual({
            esValido: true, ubicaciones: [{ ...punto, nombreUbicacion: "Quinta", departamento: "San José" }],
        });
    });

    it.each([{}, { departamento: null }])("permite conservar una ubicación anterior sin departamento", (legado) => {
        expect(validarUbicacionesProductor([{ ...punto, ...legado }])).toEqual({
            esValido: true, ubicaciones: [{ ...punto, nombreUbicacion: "Quinta", ...legado }],
        });
    });

    it.each(["", "Buenos Aires", "Quinta de Salto", 2, {}, []])("rechaza un departamento inválido: %s", (departamento) => {
        expect(validarUbicacionesProductor([{ ...punto, departamento }])).toEqual({
            esValido: false, error: "Seleccioná una ubicación en el mapa para identificar su departamento de Uruguay.",
        });
    });

    it("explica cómo completar un punto que todavía no se seleccionó en el mapa", () => {
        expect(validarUbicacionesProductor([{ ...punto, urlMaps: "" }])).toEqual({
            esValido: false, error: "Seleccioná cada punto de retiro en el mapa antes de guardar.",
        });
    });
});
