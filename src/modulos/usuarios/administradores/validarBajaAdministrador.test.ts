import { describe, expect, it } from "vitest";
import { validarBajaAdministrador } from "./validarBajaAdministrador";

describe("validar baja de administrador", () => {
	it("rechaza datos nulos", () => {
		const resultado = validarBajaAdministrador(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos de la baja no son válidos."],
		});
	});

	it("rechaza datos que no son objetos", () => {
		const resultado = validarBajaAdministrador("123");

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos de la baja no son válidos."],
		});
	});

	it("rechaza un administradorId que no es un número", () => {
		const resultado = validarBajaAdministrador({
			administradorId: "123",
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El administrador seleccionado no es válido."],
		});
	});

	it("rechaza un administradorId decimal", () => {
		const resultado = validarBajaAdministrador({
			administradorId: 1.5,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El administrador seleccionado no es válido."],
		});
	});

	it("rechaza un administradorId igual a cero", () => {
		const resultado = validarBajaAdministrador({
			administradorId: 0,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El administrador seleccionado no es válido."],
		});
	});

	it("rechaza un administradorId negativo", () => {
		const resultado = validarBajaAdministrador({
			administradorId: -1,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El administrador seleccionado no es válido."],
		});
	});

	it("acepta un administradorId válido", () => {
		const resultado = validarBajaAdministrador({
			administradorId: 10,
		});

		expect(resultado).toEqual({
			esValido: true,
			datos: {
				administradorId: 10,
			},
		});
	});
});