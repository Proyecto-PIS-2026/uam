import { describe, expect, it } from "vitest";
 
import { validarModificacionOperador } from "./validarModificacionOperador";
 
const localValido = { nombre: "022", naveId: 2, contrato: "2026-12-31" };
 
const datosValidos = {
    operadorId: 7,
    nombre: "Caporale",
    codigoPais: "+598",
    telefono: "99123456",
    contraseña: "",
    confirmacionContraseña: "",
    locales: [localValido],
};

// Valida los datos de base con los cambios indicados.
function validar(cambios: Record<string, unknown> = {}) {
    return validarModificacionOperador({ ...datosValidos, ...cambios });
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
 
describe("validarModificacionOperador", () => {
    describe("datos válidos", () => {
        it("acepta datos correctos y los devuelve normalizados", () => {
            expect(datosDe()).toEqual({
                operadorId: 7,
                nombre: "Caporale",
                telefono: "+59899123456",
                contraseña: null,
                locales: [{ nombre: "022", naveId: 2, contrato: "2026-12-31" }],
            });
        });
 
        it("quita los espacios sobrantes del nombre", () => {
            expect(datosDe({ nombre: "  Caporale  " }).nombre).toBe("Caporale");
        });
    });
    
    describe("entrada que no es un objeto", () => {
        it("rechaza una entrada que no es un objeto", () => {
            const rechazo = {
                esValido: false,
                errores: ["Los datos del operador no son válidos."],
            };

            expect(validarModificacionOperador(null)).toEqual(rechazo);
            expect(validarModificacionOperador(undefined)).toEqual(rechazo);
            expect(validarModificacionOperador("texto")).toEqual(rechazo);
            expect(validarModificacionOperador(5)).toEqual(rechazo);
            expect(validarModificacionOperador([])).toEqual(rechazo);
        });
    });
    
    describe("identificador del operador", () => {
        it("rechaza un identificador que no es un entero positivo", () => {
            const rechazo = ["El operador no es válido."];

            expect(erroresDe({ operadorId: 0 })).toEqual(rechazo);
            expect(erroresDe({ operadorId: -1 })).toEqual(rechazo);
            expect(erroresDe({ operadorId: 1.5 })).toEqual(rechazo);
            expect(erroresDe({ operadorId: "7" })).toEqual(rechazo);
            expect(erroresDe({ operadorId: undefined })).toEqual(rechazo);
        });
    });

    describe("nombre", () => {
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
        it("quita espacios, guiones y ceros iniciales, y antepone el código de país", () => {
            expect(datosDe({ telefono: "099 123-456" }).telefono).toBe("+59899123456");
        });
 
        it("acepta el mínimo de 7 dígitos", () => {
            expect(datosDe({ telefono: "1234567" }).telefono).toBe("+5981234567");
        });
 
        it("acepta el máximo de 12 dígitos", () => {
            expect(datosDe({ telefono: "123456789012" }).telefono).toBe("+598123456789012");
        });
 
        it.each(["123456", "1234567890123", "99abc456", ""])(
            "rechaza el teléfono %j",
            (telefono) => {
                expect(erroresDe({ telefono })).toEqual(["El teléfono no es válido."]);
            },
        );
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

    describe("locales", () => {
        it.each([{ locales: [] }, { locales: undefined }, { locales: "022" }])(
            "exige al menos un local (caso %#)",
            (cambios) => {
                expect(erroresDe(cambios)).toEqual(["Debe haber al menos un local."]);
            },
        );
 
        it.each(["", "   "])("rechaza un local con el número %j", (nombre) => {
            const errores = erroresDe({ locales: [{ ...localValido, nombre }] });
 
            expect(errores).toEqual(["Local 1: falta su número."]);
        });
 
        it("acepta un local sin fecha de fin de contrato", () => {
            const datos = datosDe({ locales: [{ ...localValido, contrato: "" }] });
 
            expect(datos.locales).toEqual([{ nombre: "022", naveId: 2, contrato: "" }]);
        });

        it.each(["no-es-fecha", "31/12/2026"])(
            "rechaza la fecha de fin de contrato %j",
            (contrato) => {
                const errores = erroresDe({ locales: [{ ...localValido, contrato }] });
 
                expect(errores).toEqual([
                    "Local 1: la fecha de fin de contrato no es válida.",
                ]);
            },
        );
 
        it.each([0, -1, 1.5, "2", undefined])("rechaza la nave %j", (naveId) => {
            const errores = erroresDe({ locales: [{ ...localValido, naveId }] });
 
            expect(errores).toEqual(["Local 1: seleccioná una nave."]);
        });
 
        it("rechaza un local que no es un objeto", () => {
            expect(erroresDe({ locales: [null] })).toEqual([
                "Local 1: falta su número.",
                "Local 1: seleccioná una nave.",
            ]);
        });

        it("rechaza dos locales con el mismo número en la misma nave", () => {
            const errores = erroresDe({
                locales: [localValido, { ...localValido, contrato: "" }],
            });
 
            expect(errores).toEqual([
                "Local 2: está repetido en el formulario (mismo número en la misma nave).",
            ]);
        });
 
        it("acepta el mismo número de local en naves distintas", () => {
            const datos = datosDe({
                locales: [localValido, { ...localValido, naveId: 1 }],
            });
 
            expect(datos.locales).toHaveLength(2);
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