import { describe, expect, it } from "vitest";
import { validarAltaPublicacionOperador } from "./validarAltaPublicacionOperador";

const datosValidos = {
	operadorId: 1,
	especieId: 1,
	variedadId: 1,
	presentacionId: 1,
	calibreId: 1,
	categoriaId: 1,
	paisId: 1,
	disponibilidad: true,
};

describe("alta de publicación de operador: precio", () => {
	it.each([
		["omitido", {}],
		["vacío", { precio: "" }],
		["entero", { precio: "1250" }],
		["de diez dígitos", { precio: "1234567890" }],
	] as const)("acepta un precio %s", (_caso, precio) => {
		expect(validarAltaPublicacionOperador({ ...datosValidos, ...precio }).esValido).toBe(true);
	});

	it.each([
		["decimal con coma", "1250,50"],
		["decimal con punto", "1250.50"],
		["letras", "abc"],
		["letras y números", "12abc"],
		["signo negativo", "-100"],
		["signo positivo", "+100"],
		["espacio interno", "1 250"],
		["separador de miles", "1.250"],
		["más de diez dígitos", "12345678901"],
	] as const)("rechaza un precio con %s", (_caso, precio) => {
		expect(validarAltaPublicacionOperador({ ...datosValidos, precio })).toEqual({
			esValido: false,
			errores: ["El precio debe ser un número entero."],
		});
	});
});

describe("validarAltaPublicacionOperador", () => {
	it("acepta una fotografía de exactamente 10 MB", () => {
		const tamano = 10 * 1024 * 1024;
		const base64 = "A".repeat(Math.floor(tamano / 3) * 4) + "AA==";
		const fotografia = `data:image/jpeg;base64,${base64}`;
		expect(validarAltaPublicacionOperador({ ...datosValidos, fotografia }).esValido).toBe(true);
	});

	it("rechaza una fotografía de más de 10 MB aunque el base64 tenga el mismo largo", () => {
		const tamano = 10 * 1024 * 1024;
		const base64 = "A".repeat(Math.floor(tamano / 3) * 4) + "AAA=";
		const fotografia = `data:image/jpeg;base64,${base64}`;
		expect(validarAltaPublicacionOperador({ ...datosValidos, fotografia })).toEqual({
			esValido: false,
			errores: ["La fotografía debe ser PNG, JPEG o WebP y pesar hasta 10 MB."],
		});
	});

	it.each(["data:image/jpeg;base64,A", "data:image/jpeg;base64,", "data:image/gif;base64,AAAA"])("rechaza una fotografía codificada inválida: %s", (fotografia) => {
		expect(validarAltaPublicacionOperador({ ...datosValidos, fotografia }).esValido).toBe(false);
	});

	it("acepta una publicación completa con precio entero", () => {
		const resultado = validarAltaPublicacionOperador({ ...datosValidos, precio: "1250" });

		expect(resultado).toEqual({
			esValido: true,
			datos: { ...datosValidos, precio: "1250" },
		});
	});

	it("rechaza una entrada que no es un objeto", () => {
		expect(validarAltaPublicacionOperador(null)).toEqual({
			esValido: false,
			errores: ["Los datos de la publicación no son válidos."],
		});
	});

	it("rechaza campos obligatorios inválidos", () => {
		const resultado = validarAltaPublicacionOperador({ ...datosValidos, operadorId: 0, especieId: "1" });

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El campo operadorId es obligatorio.", "El campo especieId es obligatorio."],
		});
	});

	it("rechaza una disponibilidad inválida", () => {
		const resultado = validarAltaPublicacionOperador({ ...datosValidos, disponibilidad: "sí" });

		expect(resultado).toEqual({
			esValido: false,
			errores: ["La disponibilidad no es válida."],
		});
	});
});
