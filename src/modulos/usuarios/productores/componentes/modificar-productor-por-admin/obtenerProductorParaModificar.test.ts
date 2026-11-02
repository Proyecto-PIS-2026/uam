import { describe, expect, it } from "vitest";
import { separarTelefono } from "./obtenerProductorParaModificar";

describe("separarTelefono", () => {
    it.each([
        { numero: "+59899123456", codigoPais: "+598", telefono: "99123456" },
        { numero: "+595912345678", codigoPais: "+595", telefono: "912345678" },
        { numero: "+541123456789", codigoPais: "+54", telefono: "1123456789" },
    ])("separa el código de país de $numero", ({ numero, codigoPais, telefono }) => {
        expect(separarTelefono(numero)).toEqual({ codigoPais, telefono });
    });

    it("conserva un contacto vacío sin inventar un número", () => {
        expect(separarTelefono("")).toEqual({ codigoPais: "+598", telefono: "" });
    });

    it("usa el país predeterminado para un número sin prefijo", () => {
        expect(separarTelefono("99123456")).toEqual({ codigoPais: "+598", telefono: "99123456" });
    });
});
