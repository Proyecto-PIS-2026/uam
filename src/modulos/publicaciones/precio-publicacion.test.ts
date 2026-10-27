import { describe, expect, it } from "vitest";
import { esEntradaPrecioPublicacion, normalizarPrecioPublicacion, precioPublicacionValido } from "./precio-publicacion";

describe("precio de publicación", () => {
    it.each([null, undefined, "", "   "])("normaliza %j como sin precio", (valor) => {
        expect(normalizarPrecioPublicacion(valor)).toBeNull();
    });

    it.each(["1", "125", "000125", "9999999999"])("acepta el entero positivo %s", (valor) => {
        expect(esEntradaPrecioPublicacion(valor)).toBe(true);
        expect(precioPublicacionValido(valor)).toBe(true);
        expect(normalizarPrecioPublicacion(valor)).toBe(String(Number(valor)));
    });

    it.each(["0", "000", "-1", "+1", "1.5", "1,5", "1e3", "1 000", "abc", "10000000000"])("rechaza %j sin reinterpretarlo", (valor) => {
        expect(esEntradaPrecioPublicacion(valor)).toBe(false);
        expect(precioPublicacionValido(valor)).toBe(false);
        expect(() => normalizarPrecioPublicacion(valor)).toThrow("entero positivo");
    });

    it("permite borrar y normaliza espacios de la API sin aceptarlos al escribir", () => {
        expect(esEntradaPrecioPublicacion("")).toBe(true);
        expect(esEntradaPrecioPublicacion(" 125 ")).toBe(false);
        expect(precioPublicacionValido(" 125 ")).toBe(true);
        expect(normalizarPrecioPublicacion(" 125 ")).toBe("125");
        expect(precioPublicacionValido(125)).toBe(false);
        expect(precioPublicacionValido(undefined)).toBe(false);
    });
});
