import { describe, expect, it } from "vitest";
import { validarCambioContrasena } from "./validarCambioContrasena";

describe("validar cambio de contraseña", () => {
    it.each([null, undefined, [], "texto", 12])("rechaza una entrada inválida: %s", valor => {
        expect(validarCambioContrasena(valor).esValido).toBe(false);
    });
    it.each([{}, { actual: 1, nueva: 3, confirmacion: 3 }, { actual: "", nueva: "corta", confirmacion: "otra" }])("informa errores de campos: %j", valor => {
        const resultado = validarCambioContrasena(valor);
        expect(resultado.esValido).toBe(false);
        if (!resultado.esValido) expect(resultado.errores).toHaveLength(3);
    });
    it("acepta ocho caracteres sin alterar espacios ni aceptar identificadores del cliente", () => {
        expect(validarCambioContrasena({ actual: " anterior ", nueva: " nueva12", confirmacion: " nueva12", usuarioId: 99 })).toEqual({
            esValido: true, datos: { actual: " anterior ", nueva: " nueva12" },
        });
    });
});
