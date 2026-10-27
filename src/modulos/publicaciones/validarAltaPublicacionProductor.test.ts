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

    it("acepta varias ubicaciones y normaliza los nombres y enlaces", () => {
        const ubicaciones = [
            { nombreUbicacion: " Chacra norte ", urlMaps: " https://www.google.com/maps?q=-34.7,-56.1 " },
            { nombreUbicacion: " Puesto de retiro ", urlMaps: " https://maps.app.goo.gl/ejemplo " },
        ];
        expect(validarAltaPublicacionProductor({ ...datosValidos, ubicaciones })).toEqual({
            esValido: true, datos: { ...datosValidos, ubicaciones: [
                { nombreUbicacion: "Chacra norte", urlMaps: "https://www.google.com/maps?q=-34.7,-56.1" },
                { nombreUbicacion: "Puesto de retiro", urlMaps: "https://maps.app.goo.gl/ejemplo" },
            ] },
        });
    });

    it.each([[], null, undefined].map((ubicaciones) => ({ ubicaciones })))("una lista explícita vacía prevalece sobre las coordenadas anteriores: $ubicaciones", ({ ubicaciones }) => {
        expect(validarAltaPublicacionProductor({ ...datosValidos, ubicaciones, latitud: "inválida", nombreLugar: 1 })).toMatchObject({
            esValido: true, datos: { ubicaciones: [] },
        });
    });

    it("acepta hasta 20 ubicaciones con nombres y enlaces en su longitud máxima", () => {
        const prefijo = "https://www.google.com/maps?q=";
        const ubicacion = { nombreUbicacion: "a".repeat(200), urlMaps: prefijo + "a".repeat(2048 - prefijo.length) };
        const ubicaciones = Array.from({ length: 20 }, () => ({ ...ubicacion }));
        expect(validarAltaPublicacionProductor({ ...datosValidos, ubicaciones })).toEqual({
            esValido: true, datos: { ...datosValidos, ubicaciones },
        });
    });

    it.each([
        { ubicaciones: "ubicación", error: "Las ubicaciones no son válidas." },
        { ubicaciones: [null], error: "La ubicación no es válida." },
        { ubicaciones: ["ubicación"], error: "La ubicación no es válida." },
        { ubicaciones: [{ nombreUbicacion: " ", urlMaps: "https://maps.google.com" }], error: "Cada ubicación debe tener un nombre de hasta 200 caracteres." },
        { ubicaciones: [{ nombreUbicacion: "a".repeat(201), urlMaps: "https://maps.google.com" }], error: "Cada ubicación debe tener un nombre de hasta 200 caracteres." },
        { ubicaciones: Array.from({ length: 21 }, () => ({ nombreUbicacion: "Chacra", urlMaps: "https://maps.google.com" })), error: "Se permiten hasta 20 ubicaciones por publicación." },
    ])("rechaza ubicaciones inválidas: $error", ({ ubicaciones, error }) => {
        expect(validarAltaPublicacionProductor({ ...datosValidos, ubicaciones })).toEqual({ esValido: false, errores: [error] });
    });

    it.each([
        "https://google.com.ejemplo.test/maps", "https://www.google.com/otro", "javascript:alert(1)",
        "https://usuario@maps.google.com", "https://maps.google.com:8080", "https://maps.app.goo.gl/",
        "https://www.google.com/maps?q=" + "a".repeat(2048),
    ])("rechaza enlaces de ubicación que no cumplen las reglas de edición: %s", (urlMaps) => {
        expect(validarAltaPublicacionProductor({ ...datosValidos, ubicaciones: [{ nombreUbicacion: "Chacra", urlMaps }] })).toEqual({
            esValido: false, errores: ["Seleccioná cada punto de retiro en el mapa antes de guardar."],
        });
    });

    it.each(["", null, "001250", "1250", " 1250 ", "9999999999"])("acepta el precio entero o ausente %j", (precio) => {
        expect(validarAltaPublicacionProductor({ ...datosValidos, precio }).esValido).toBe(true);
    });

    it.each(["0", "000", "1.5", "1,5", "-1", "texto", "10000000000", 25])("rechaza el precio inválido %j", (precio) => {
        expect(validarAltaPublicacionProductor({ ...datosValidos, precio })).toEqual({
            esValido: false, errores: ["El precio debe ser un número entero positivo de hasta 10 dígitos, sin decimales."],
        });
    });

    it.each([null, [], "producto", 123].map((valor) => ({ valor })))("rechaza un cuerpo que no es un objeto: $valor", ({ valor }) => {
        expect(validarAltaPublicacionProductor(valor)).toEqual({ esValido: false, errores: ["Los datos de la publicación no son válidos."] });
    });

    it.each(["productorId", "especieId"])("exige un identificador válido para %s", (campo) => {
        for (const valor of [undefined, "1", 0, -1, 1.5, 2147483648]) {
            expect(validarAltaPublicacionProductor({ ...datosValidos, [campo]: valor }).esValido).toBe(false);
        }
    });

    it.each(["variedadId", "presentacionId", "calibreId", "categoriaId", "paisId"])("valida el identificador opcional %s si se informa", (campo) => {
        for (const valor of ["1", -1, 1.5, 2147483648, true]) {
            expect(validarAltaPublicacionProductor({ ...datosValidos, [campo]: valor }).esValido).toBe(false);
        }
    });

    it.each([undefined, null, "", 0])("acepta solo especie con el resto vacío: %j", (vacio) => {
        expect(validarAltaPublicacionProductor({ productorId: 1, especieId: 2, variedadId: vacio, presentacionId: vacio,
            categoriaId: vacio, calibreId: vacio, paisId: vacio })).toMatchObject({ esValido: true, datos: {
            especieId: 2, variedadId: null, presentacionId: null, categoriaId: null, calibreId: null, paisId: null, disponibilidad: true,
        } });
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
        expect(resultado).toEqual({ esValido: false, errores: ["La latitud no es válida.", "La disponibilidad no es válida.", "El precio debe ser un número entero positivo de hasta 10 dígitos, sin decimales."] });
    });
});
