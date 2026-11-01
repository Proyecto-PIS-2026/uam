import { describe, expect, it } from "vitest";

import { validarModificacionAdministrador } from "./validarModificacionAdministrador";

const datosValidos = {
    administradorId: 102,
    nombreUsuario: "beto.admin",
    email: "beto@example.com",
};

function validar(cambios: Record<string, unknown> = {}) {
    return validarModificacionAdministrador({ ...datosValidos, ...cambios });
}

function erroresDe(cambios: Record<string, unknown> = {}): string[] {
    const resultado = validar(cambios);
    return resultado.esValido ? [] : resultado.errores;
}

describe("validarModificacionAdministrador", () => {
    it("acepta datos correctos y quita los espacios sobrantes", () => {
        expect(validar({ nombreUsuario: "  beto.admin  ", email: "  beto@example.com " })).toEqual({
            esValido: true,
            datos: { administradorId: 102, nombreUsuario: "beto.admin", email: "beto@example.com" },
        });
    });

    it.each([null, undefined, "texto", 5, []])("rechaza la entrada %j", (entrada) => {
        expect(validarModificacionAdministrador(entrada)).toEqual({
            esValido: false,
            errores: ["Los datos del administrador no son válidos."],
        });
    });

    it.each([0, -1, 1.5, "102", undefined])("rechaza el identificador %j", (administradorId) => {
        expect(erroresDe({ administradorId })).toEqual(["El administrador no es válido."]);
    });

    it.each(["", "   ", 123])("rechaza el nombre %j", (nombreUsuario) => {
        expect(erroresDe({ nombreUsuario })).toEqual(["El nombre es obligatorio."]);
    });

    it("rechaza un nombre de menos de 3 caracteres", () => {
        expect(erroresDe({ nombreUsuario: "ab" })).toEqual(["El nombre de usuario debe tener al menos 3 caracteres."]);
    });

    it.each(["", "   "])("rechaza el correo vacío %j", (email) => {
        expect(erroresDe({ email })).toEqual(["El correo electrónico es obligatorio."]);
    });

    it.each(["beto", "beto@", "@example.com", "beto@example", "beto @example.com"])("rechaza el correo inválido %j", (email) => {
        expect(erroresDe({ email })).toEqual(["El correo electrónico no es válido."]);
    });

    it("devuelve todos los errores encontrados, en orden", () => {
        expect(erroresDe({ nombreUsuario: "", email: "beto" })).toEqual([
            "El nombre es obligatorio.",
            "El correo electrónico no es válido.",
        ]);
    });
});