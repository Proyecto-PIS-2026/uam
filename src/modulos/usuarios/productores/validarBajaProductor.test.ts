import { describe, expect, it } from "vitest";
import { validarBajaProductor } from "./validarBajaProductor";

describe("validar baja de productor", () => {
	it("rechaza datos nulos", () => {
		const resultado = validarBajaProductor(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos de la baja no son válidos."],
		});
	});

	it("rechaza datos que no son objetos", () => {
		const resultado = validarBajaProductor("123");

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos de la baja no son válidos."],
		});
	});

	it("rechaza un productorId que no es un número", () => {
		const resultado = validarBajaProductor({
			productorId: "123",
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El productor seleccionado no es válido."],
		});
	});

	it("rechaza un productorId decimal", () => {
		const resultado = validarBajaProductor({
			productorId: 1.5,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El productor seleccionado no es válido."],
		});
	});

	it("rechaza un productorId menor o igual a cero", () => {
		const resultado = validarBajaProductor({
			productorId: 0,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El productor seleccionado no es válido."],
		});
	});

	it("rechaza un productorId negativo", () => {
		const resultado = validarBajaProductor({
			productorId: -1,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El productor seleccionado no es válido."],
		});
	});

	it("acepta un productorId válido", () => {
		const resultado = validarBajaProductor({
			productorId: 10,
		});

		expect(resultado).toEqual({
			esValido: true,
			datos: {
				productorId: 10,
			},
		});
	});
});