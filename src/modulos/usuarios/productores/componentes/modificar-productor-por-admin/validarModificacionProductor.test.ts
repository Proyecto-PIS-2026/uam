import { describe, expect, it } from "vitest";

import { validarModificacionProductor } from "./validarModificacionProductor";

const datosValidos = {
    productorId: 2,
    nombre: "Granja Los Álamos",
    codigoPais: "+598",
    telefono: "99123456",
    contraseña: "",
    confirmacionContraseña: "",
};

// Valida los datos de base con los cambios indicados.
function validar(cambios: Record<string, unknown> = {}) {
    return validarModificacionProductor({ ...datosValidos, ...cambios });
}

// Devuelve la lista de errores (vacía si los datos son válidos).
function erroresDe(cambios: Record<string, unknown> = {}): string[] {
    const resultado = validar(cambios);
    return resultado.esValido ? [] : resultado.errores;
}

// Devuelve los datos. Si hubo errores, corta la prueba mostrándolos.
function datosDe(cambios: Record<string, unknown> = {}) {
    const resultado = validar(cambios);
    if (!resultado.esValido) {
        throw new Error(
            `Se esperaban datos válidos, pero hubo errores: ${resultado.errores.join(" ")}`,
        );
    }
    return resultado.datos;
}

describe("validarModificacionProductor", () => {
    describe("datos válidos", () => {
        it("acepta datos correctos y los devuelve normalizados", () => {
            expect(datosDe()).toEqual({
                productorId: 2,
                nombre: "Granja Los Álamos",
                telefono: "+59899123456",
                contraseña: null,
            });
        });

        it("quita los espacios sobrantes del nombre", () => {
            expect(datosDe({ nombre: "  Granja Los Álamos  " }).nombre).toBe("Granja Los Álamos");
        });

        it("quita espacios, paréntesis, puntos, guiones y ceros iniciales, y antepone el código de país", () => {
            expect(datosDe({ telefono: "(099) 12.34-56" }).telefono).toBe("+59899123456");
        });
    });

    describe("entrada que no es un objeto", () => {
        it("rechaza una entrada que no es un objeto", () => {
            const rechazo = {
                esValido: false,
                errores: ["Los datos del productor no son válidos."],
            };

            expect(validarModificacionProductor(null)).toEqual(rechazo);
            expect(validarModificacionProductor(undefined)).toEqual(rechazo);
            expect(validarModificacionProductor("texto")).toEqual(rechazo);
            expect(validarModificacionProductor(5)).toEqual(rechazo);
            expect(validarModificacionProductor([])).toEqual(rechazo);
        });
    });

    describe("identificador del productor", () => {
        it("rechaza un identificador que no es un entero positivo", () => {
            const rechazo = ["El productor no es válido."];

            expect(erroresDe({ productorId: 0 })).toEqual(rechazo);
            expect(erroresDe({ productorId: -1 })).toEqual(rechazo);
            expect(erroresDe({ productorId: 1.5 })).toEqual(rechazo);
            expect(erroresDe({ productorId: "2" })).toEqual(rechazo);
            expect(erroresDe({ productorId: undefined })).toEqual(rechazo);
        });
    });

    describe("nombre", () => {
        it.each([".", "..", " . ", " .. "])("rechaza el nombre reservado de ruta %j", (nombre) => {
            expect(erroresDe({ nombre })).toEqual(['El nombre no puede ser "." ni "..".']);
        });

        it.each(["Frutas S.A.", "..."])("acepta otros nombres con puntos: %s", (nombre) => {
            expect(datosDe({ nombre }).nombre).toBe(nombre);
        });

        it.each(["", "   ", 123])("rechaza el nombre %j", (nombre) => {
            expect(erroresDe({ nombre })).toEqual(["El nombre es obligatorio."]);
        });
    });

    describe("código de país", () => {
        it.each(["+1", "598", ""])("rechaza el código %j", (codigoPais) => {
            expect(erroresDe({ codigoPais })).toContain("El código de país no es válido.");
        });
    });

    describe("teléfono", () => {

        it.each([
            { codigoPais: "+598", telefono: "91234567" },
            { codigoPais: "+54", telefono: "1123456789" },
            { codigoPais: "+54", telefono: "11234567890" },
            { codigoPais: "+55", telefono: "1123456789" },
            { codigoPais: "+55", telefono: "11234567890" },
            { codigoPais: "+56", telefono: "912345678" },
            { codigoPais: "+595", telefono: "912345678" },
        ])("acepta $telefono para $codigoPais", ({ codigoPais, telefono }) => {
            expect(datosDe({ codigoPais, telefono }).telefono).toBe(codigoPais + telefono);
        });

        it.each([
            { codigoPais: "+598", telefono: "81234567" }, // no empieza con 9
            { codigoPais: "+598", telefono: "9123456" }, // le falta un dígito
            { codigoPais: "+598", telefono: "912345678" }, // le sobra un dígito
            { codigoPais: "+54", telefono: "112345678" }, // menos de 10 dígitos
            { codigoPais: "+55", telefono: "112345678901" }, // más de 11 dígitos
            { codigoPais: "+56", telefono: "812345678" }, // no empieza con 9
            { codigoPais: "+595", telefono: "91234567" }, // le falta un dígito
            { codigoPais: "+598", telefono: "99abc456" }, // tiene letras
            { codigoPais: "+598", telefono: "" }, // vacío
        ])("rechaza $telefono para $codigoPais", ({ codigoPais, telefono }) => {
            expect(erroresDe({ codigoPais, telefono })).toEqual(["El teléfono no es válido."]);
        });
    });

    describe("contraseña", () => {
        it("no cambia la contraseña si los dos campos quedan vacíos", () => {
            expect(datosDe().contraseña).toBeNull();
        });

        it("acepta una contraseña de 8 caracteres que coincide con su confirmación", () => {
            const datos = datosDe({
                contraseña: "12345678",
                confirmacionContraseña: "12345678",
            });

            expect(datos.contraseña).toBe("12345678");
        });

        it("rechaza una contraseña de menos de 8 caracteres", () => {
            const errores = erroresDe({
                contraseña: "corta1",
                confirmacionContraseña: "corta1",
            });

            expect(errores).toEqual(["La contraseña debe tener al menos 8 caracteres."]);
        });

        it("rechaza una contraseña que no coincide con su confirmación", () => {
            const errores = erroresDe({
                contraseña: "contraseña123",
                confirmacionContraseña: "contraseñaDistinta123",
            });

            expect(errores).toEqual(["Las contraseñas no coinciden."]);
        });

        it("rechaza completar solo la confirmación", () => {
            const errores = erroresDe({
                contraseña: "",
                confirmacionContraseña: "contraseña123",
            });

            expect(errores).toEqual([
                "La contraseña debe tener al menos 8 caracteres.",
                "Las contraseñas no coinciden.",
            ]);
        });
    });

    describe("varios errores a la vez", () => {
        it("devuelve todos los errores encontrados, en orden", () => {
            const errores = erroresDe({ nombre: "", telefono: "12" });

            expect(errores).toEqual([
                "El nombre es obligatorio.",
                "El teléfono no es válido.",
            ]);
        });
    });
});