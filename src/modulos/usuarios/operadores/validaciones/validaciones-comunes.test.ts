import { describe, expect, it } from "vitest";
import { validarAltaOperador } from "../validarAltaOperador";
import { validarModificacionOperador } from "./validarModificacionOperador";

function validarAmbos(cambios: Record<string, unknown>) {
    const comunes = {
        nombre: "  Frutas del Sur  ", codigoPais: "+598", telefono: "(099) 123.456", ...cambios,
    };
    return [
        validarAltaOperador({
            ...comunes, rol: "operador", nombreUsuario: "frutas", contraseña: "12345678", confirmacionContraseña: "12345678",
            locales: [{ numeroLocal: " 12 ", naveId: 2, contrato: "" }],
        }),
        validarModificacionOperador({
            ...comunes, operadorId: 4, locales: [{ nombre: " 12 ", naveId: 2, contrato: "" }],
        }),
    ];
}

describe("reglas compartidas de alta y modificación de operadores", () => {
    it.each([
        ["+598", "(099) 123.456", "+59899123456"],
        ["+54", "11 1234-5678", "+541112345678"],
        ["+55", "11 91234-5678", "+5511912345678"],
        ["+56", "9 1234-5678", "+56912345678"],
        ["+595", "9 1234-5678", "+595912345678"],
    ])("normaliza el teléfono de %s de la misma forma", (codigoPais, telefono, esperado) => {
        for (const resultado of validarAmbos({ codigoPais, telefono })) {
            expect(resultado.esValido).toBe(true);
            if (resultado.esValido) {
                expect(resultado.datos.telefono).toBe(esperado);
                expect(resultado.datos.nombre).toBe("Frutas del Sur");
            }
        }
    });

    it.each([
        { telefono: "1234567" },
        { telefono: "123456789012" },
        { codigoPais: "+56", telefono: "812345678" },
        { codigoPais: "+595", telefono: "91234567" },
        { codigoPais: "toString" },
        { nombre: "Frutas 100%" },
    ])("rechaza los mismos valores en ambas operaciones %j", (cambios) => {
        const [alta, modificacion] = validarAmbos(cambios);
        expect(alta.esValido).toBe(false);
        expect(modificacion.esValido).toBe(false);
        if (!alta.esValido && !modificacion.esValido) expect(alta.errores).toEqual(modificacion.errores);
    });
});
