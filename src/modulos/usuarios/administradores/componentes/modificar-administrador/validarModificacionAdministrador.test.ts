import { describe, expect, it } from "vitest";

import { validarModificacionAdministrador } from "./validarModificacionAdministrador";

const datosValidos = {
    administradorId: 102,
    nombreUsuario: "beto.admin",
    email: "beto@ejemplo.com",
    contraseña: "",
    confirmacionContraseña: "",
};

function validar(cambios: Record<string, unknown> = {}) {
    return validarModificacionAdministrador({ ...datosValidos, ...cambios });
}

function erroresDe(cambios: Record<string, unknown> = {}): string[] {
    const resultado = validar(cambios);
    return resultado.esValido ? [] : resultado.errores;
}

describe("validarModificacionAdministrador", () => {
    it("acepta datos correctos, quita los espacios sobrantes y no cambia la contraseña", () => {
        expect(validar({ nombreUsuario: "  beto.admin  ", email: "  beto@ejemplo.com " })).toEqual({
            esValido: true,
            datos: { administradorId: 102, nombreUsuario: "beto.admin", email: "beto@ejemplo.com", contraseña: null },
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

    it.each(["beto", "beto@", "@ejemplo.com", "beto@ejemplo", "beto @ejemplo.com"])("rechaza el correo inválido %j", (email) => {
        expect(erroresDe({ email })).toEqual(["El correo electrónico no es válido."]);
    });

    describe("contraseña", () => {
        it("acepta una contraseña de 8 caracteres que coincide con su confirmación", () => {
            const resultado = validar({ contraseña: "12345678", confirmacionContraseña: "12345678" });

            expect(resultado.esValido && resultado.datos.contraseña).toBe("12345678");
        });

        it("rechaza una contraseña de menos de 8 caracteres", () => {
            expect(erroresDe({ contraseña: "corta1", confirmacionContraseña: "corta1" })).toEqual([
                "La contraseña debe tener al menos 8 caracteres.",
            ]);
        });

        it("rechaza una contraseña que no coincide con su confirmación", () => {
            expect(erroresDe({ contraseña: "contraseña123", confirmacionContraseña: "contraseñaDistinta123" })).toEqual([
                "Las contraseñas no coinciden.",
            ]);
        });

        it("rechaza completar solo la confirmación", () => {
            expect(erroresDe({ contraseña: "", confirmacionContraseña: "contraseña123" })).toEqual([
                "La contraseña debe tener al menos 8 caracteres.",
                "Las contraseñas no coinciden.",
            ]);
        });
    });

    it("devuelve todos los errores encontrados, en orden", () => {
        expect(erroresDe({ nombreUsuario: "", email: "beto", contraseña: "corta" })).toEqual([
            "El nombre es obligatorio.",
            "El correo electrónico no es válido.",
            "La contraseña debe tener al menos 8 caracteres.",
            "Las contraseñas no coinciden.",
        ]);
    });
});