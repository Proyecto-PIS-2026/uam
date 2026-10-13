import { describe, expect, it } from "vitest";
import { validarBajaOperador } from "./validarBajaOperador";

describe("validar baja de operador", () => {
	it("rechaza datos nulos", () => {
		const resultado = validarBajaOperador(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos de la baja no son válidos."],
		});
	});

	it("rechaza datos que no son objetos", () => {
		const resultado = validarBajaOperador("123");

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos de la baja no son válidos."],
		});
	});

	it("rechaza un operadorId que no es un número", () => {
		const resultado = validarBajaOperador({
			operadorId: "123",
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El operador seleccionado no es válido."],
		});
	});

	it("rechaza un operadorId decimal", () => {
		const resultado = validarBajaOperador({
			operadorId: 1.5,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El operador seleccionado no es válido."],
		});
	});

	it("rechaza un operadorId menor o igual a cero", () => {
		const resultado = validarBajaOperador({
			operadorId: 0,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El operador seleccionado no es válido."],
		});
	});

	it("rechaza un operadorId negativo", () => {
		const resultado = validarBajaOperador({
			operadorId: -1,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El operador seleccionado no es válido."],
		});
	});

	it("acepta un operadorId válido", () => {
		const resultado = validarBajaOperador({
			operadorId: 10,
		});

		expect(resultado).toEqual({
			esValido: true,
			datos: {
				operadorId: 10,
			},
		});
	});
});