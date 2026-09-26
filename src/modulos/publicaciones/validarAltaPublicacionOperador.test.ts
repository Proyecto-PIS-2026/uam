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
