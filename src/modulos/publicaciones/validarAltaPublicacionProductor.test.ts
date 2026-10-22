import { describe, expect, it } from "vitest";
import { validarAltaPublicacionProductor } from "./validarAltaPublicacionProductor";

const datosValidos = {
    productorId: 1, especieId: 2, variedadId: 3, presentacionId: 4,
    calibreId: 5, categoriaId: 6, paisId: 7,
    latitud: -34.9, longitud: -56.2, departamento: "Montevideo",
    nombreLugar: null, disponibilidad: true,
};

describe("validarAltaPublicacionProductor", () => {
    it("permite publicar sin precio, cantidad ni fotografía", () => {
        expect(validarAltaPublicacionProductor(datosValidos)).toEqual({ esValido: true, datos: datosValidos });
    });

    it.each(["", "0", "1250", " 1250 ", "9999999999"])("acepta el precio entero %j", (precio) => {
        expect(validarAltaPublicacionProductor({ ...datosValidos, precio }).esValido).toBe(true);
    });

    it.each(["1.5", "1,5", "-1", "texto", "10000000000", 25, null])("rechaza el precio inválido %j", (precio) => {
        expect(validarAltaPublicacionProductor({ ...datosValidos, precio })).toEqual({
            esValido: false, errores: ["El precio debe ser un número entero."],
        });
    });

    it.each([null, [], "producto", 123].map((valor) => ({ valor })))("rechaza un cuerpo que no es un objeto: $valor", ({ valor }) => {
        expect(validarAltaPublicacionProductor(valor)).toEqual({ esValido: false, errores: ["Los datos de la publicación no son válidos."] });
    });

    it.each(["productorId", "especieId", "variedadId", "presentacionId", "calibreId", "categoriaId", "paisId"])("exige un identificador válido para %s", (campo) => {
        for (const valor of [undefined, "1", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
            expect(validarAltaPublicacionProductor({ ...datosValidos, [campo]: valor })).toEqual({ esValido: false, errores: [`El campo ${campo} es obligatorio.`] });
        }
    });

    it.each([
        { campo: "latitud", valor: 91, error: "La latitud no es válida." },
        { campo: "latitud", valor: -91, error: "La latitud no es válida." },
        { campo: "latitud", valor: NaN, error: "La latitud no es válida." },
        { campo: "longitud", valor: 181, error: "La longitud no es válida." },
        { campo: "longitud", valor: -181, error: "La longitud no es válida." },
        { campo: "longitud", valor: "-56", error: "La longitud no es válida." },
        { campo: "departamento", valor: " ", error: "El departamento de la ubicación no es válido." },
        { campo: "departamento", valor: null, error: "El departamento de la ubicación no es válido." },
        { campo: "nombreLugar", valor: "", error: "El nombre de la ubicación no es válido." },
        { campo: "nombreLugar", valor: 1, error: "El nombre de la ubicación no es válido." },
        { campo: "nombreLugar", valor: "a".repeat(301), error: "El nombre de la ubicación no es válido." },
        { campo: "disponibilidad", valor: "true", error: "La disponibilidad no es válida." },
    ])("rechaza $campo inválido", ({ campo, valor, error }) => {
        expect(validarAltaPublicacionProductor({ ...datosValidos, [campo]: valor })).toEqual({ esValido: false, errores: [error] });
    });

    it.each([undefined, null, 0, 2147483647])("acepta la cantidad %j", (cantidadUnidades) => {
        expect(validarAltaPublicacionProductor({ ...datosValidos, cantidadUnidades }).esValido).toBe(true);
    });

    it.each([-1, 0.5, 2147483648, "10", Infinity])("rechaza la cantidad %j", (cantidadUnidades) => {
        expect(validarAltaPublicacionProductor({ ...datosValidos, cantidadUnidades })).toEqual({
            esValido: false, errores: ["La cantidad de unidades debe ser un número entero entre 0 y 2147483647."],
        });
    });

    it.each(["", "data:image/png;base64,YQ==", "data:image/jpeg;base64,YWI=", "data:image/webp;base64,YWJj"])("acepta fotografía opcional o codificada en formato permitido", (fotografia) => {
        expect(validarAltaPublicacionProductor({ ...datosValidos, fotografia }).esValido).toBe(true);
    });

    it.each([null, 1, "archivo.png", "data:image/gif;base64,YQ==", "data:image/png;base64,", "data:image/png;base64,YQ=", "data:image/png;base64,!!!!"])("rechaza fotografía mal codificada o de formato no permitido: %j", (fotografia) => {
        expect(validarAltaPublicacionProductor({ ...datosValidos, fotografia }).esValido).toBe(false);
    });

    it("acepta una fotografía de 10 MB y rechaza la que excede el límite", () => {
        const fotografia = (tamano: number) => `data:image/png;base64,${Buffer.alloc(tamano).toString("base64")}`;
        expect(validarAltaPublicacionProductor({ ...datosValidos, fotografia: fotografia(10 * 1024 * 1024) }).esValido).toBe(true);
        expect(validarAltaPublicacionProductor({ ...datosValidos, fotografia: fotografia(10 * 1024 * 1024 + 1) }).esValido).toBe(false);
    });

    it("informa todos los campos que deben corregirse", () => {
        const resultado = validarAltaPublicacionProductor({ ...datosValidos, precio: "texto", latitud: null, disponibilidad: null });
        expect(resultado).toEqual({ esValido: false, errores: ["La latitud no es válida.", "La disponibilidad no es válida.", "El precio debe ser un número entero."] });
    });
});
