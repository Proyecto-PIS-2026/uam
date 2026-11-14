import { describe, expect, it } from "vitest";
import { mensajeConflictoCatalogo, validarDatosCatalogo, valorDuplicado } from "./validaciones";

describe("validación de valores administrativos", () => {
    it("normaliza espacios sin alterar la escritura elegida", () => {
        expect(validarDatosCatalogo("empaquetados", { nombre: "  Cajón   grande \n " })).toEqual({ nombre: "Cajón grande" });
    });

    it.each([
        ["02,500", "2.5"], [" 010 - 012,00 ", "10-12"], ["18-24", "18-24"], ["0.5", "0.5"],
    ])("admite y normaliza el peso %s", (nombre, esperado) => {
        expect(validarDatosCatalogo("kilos", { nombre })).toEqual({ nombre: esperado });
    });

    it.each(["0", "-2", "2-1", "2-2", "1-2-3", "dos", "Infinity"])("rechaza el peso inválido %s", (nombre) => {
        expect(() => validarDatosCatalogo("kilos", { nombre })).toThrow("Ingresá un peso positivo");
    });

    it.each([
        { datos: null }, { datos: [] }, { datos: { nombre: 12 } }, { datos: { nombre: "" } }, { datos: { nombre: "x".repeat(121) } },
    ])("rechaza datos incompletos o excesivos", ({ datos }) => {
        expect(() => validarDatosCatalogo("categorias", datos)).toThrow();
    });

    it.each([undefined, "", "  ", "x".repeat(61)])("requiere un código válido para calibres", (codigo) => {
        expect(() => validarDatosCatalogo("calibres", { nombre: "Grande", codigo })).toThrow();
    });

    it("considera duplicado tanto el código como el nombre del calibre", () => {
        const existentes = [{ id: 1, nombre: "Extra grande", codigo: "EG" }];
        expect(valorDuplicado("calibres", existentes, { nombre: "Otro", codigo: " eg " })).toBe(true);
        expect(valorDuplicado("calibres", existentes, { nombre: " EXTRA   GRANDE ", codigo: "Nuevo" })).toBe(true);
        expect(valorDuplicado("calibres", existentes, { nombre: "Extra grande", codigo: "EG" }, 1)).toBe(false);
    });

    it("considera iguales las distintas representaciones del mismo peso", () => {
        expect(valorDuplicado("kilos", [{ id: 1, nombre: "2,500" }], { nombre: "02.50" })).toBe(true);
    });

    it("no recorre indefinidamente una cadena de errores circular", () => {
        const error: { cause?: unknown } = {};
        error.cause = error;
        expect(mensajeConflictoCatalogo(error, false)).toBeNull();
    });
});
