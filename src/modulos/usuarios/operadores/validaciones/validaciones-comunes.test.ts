import { describe, expect, it } from "vitest";
import { validarAltaOperador } from "../validarAltaOperador";
import { validarModificacionOperador } from "./validarModificacionOperador";

function validarAmbos(cambios: Record<string, unknown>, numeroLocal: unknown = " 12 ") {
    const comunes = {
        nombre: "  Frutas del Sur  ", codigoPais: "+598", telefono: "(099) 123.456", ...cambios,
    };
    return [
        validarAltaOperador({
            ...comunes, rol: "operador", nombreUsuario: "frutas", contraseña: "12345678", confirmacionContraseña: "12345678",
            locales: [{ numeroLocal, naveId: 2, contrato: "" }],
        }),
        validarModificacionOperador({
            ...comunes, operadorId: 4, locales: [{ nombre: numeroLocal, naveId: 2, contrato: "" }],
        }),
    ];
}

describe("reglas compartidas de alta y modificación de operadores", () => {
    it.each(["A22", "22B", "-22", "+22", "2.2", "2,2", "2e2", "02 2", "02\n2"])(
        "rechaza el número de local no compuesto solo por dígitos %j en ambas operaciones",
        (numeroLocal) => {
            for (const resultado of validarAmbos({}, numeroLocal)) {
                expect(resultado).toEqual({
                    esValido: false,
                    errores: ["Local 1: el número debe contener solo dígitos."],
                });
            }
        },
    );

    it.each(["", "   ", null, 22])("exige un número de local como texto al guardar %j", (numeroLocal) => {
        for (const resultado of validarAmbos({}, numeroLocal)) {
            expect(resultado).toEqual({ esValido: false, errores: ["Local 1: falta el número."] });
        }
    });

    it.each(["022", "000", "0", "12345678901234567890"])(
        "conserva el número de local %s como texto, incluidos sus ceros iniciales",
        (numeroLocal) => {
            const [alta, modificacion] = validarAmbos({}, numeroLocal);
            expect(alta).toMatchObject({ esValido: true, datos: { locales: [{ numeroLocal }] } });
            expect(modificacion).toMatchObject({ esValido: true, datos: { locales: [{ nombre: numeroLocal }] } });
        },
    );

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
