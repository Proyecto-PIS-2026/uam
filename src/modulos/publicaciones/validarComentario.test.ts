import { describe, expect, it } from "vitest";

import { LARGO_MAXIMO_COMENTARIO, validarComentario } from "./validarComentario";

describe("validarComentario", () => {
    it.each([undefined, null, "", "   "])("acepta %j como sin comentario", (valor) => {
        expect(validarComentario(valor)).toEqual({ esValido: true, comentario: null });
    });

    it("acepta un comentario y quita los espacios de los costados", () => {
        expect(validarComentario("  Cosecha de esta semana  ")).toEqual({
            esValido: true,
            comentario: "Cosecha de esta semana",
        });
    });

    it("conserva los saltos de línea dentro del comentario", () => {
        expect(validarComentario("Primera línea\nSegunda línea")).toEqual({
            esValido: true,
            comentario: "Primera línea\nSegunda línea",
        });
    });

    it("acepta un comentario del largo máximo", () => {
        const comentario = "a".repeat(LARGO_MAXIMO_COMENTARIO);

        expect(validarComentario(comentario)).toEqual({ esValido: true, comentario });
    });

    it("rechaza un comentario que supera el largo máximo", () => {
        expect(validarComentario("a".repeat(LARGO_MAXIMO_COMENTARIO + 1))).toEqual({
            esValido: false,
            error: `El comentario no puede superar los ${LARGO_MAXIMO_COMENTARIO} caracteres.`,
        });
    });

    it("mide el largo después de quitar los espacios", () => {
        const comentario = `  ${"a".repeat(LARGO_MAXIMO_COMENTARIO)}  `;

        expect(validarComentario(comentario)).toEqual({ esValido: true, comentario: comentario.trim() });
    });

    it.each([5, true, {}, []])("rechaza el valor %j, que no es texto", (valor) => {
        expect(validarComentario(valor)).toEqual({ esValido: false, error: "El comentario no es válido." });
    });
});