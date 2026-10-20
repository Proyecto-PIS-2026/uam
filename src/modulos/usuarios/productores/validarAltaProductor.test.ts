import { describe, expect, it } from "vitest";
import { validarAltaProductor } from "./validarAltaProductor";

function armarDatos(sobrescribir: Record<string, unknown> = {}) {
	return {
		rol: "productor",
		nombreUsuario: "probandotest",
		contraseña: "clave12345",
		confirmacionContraseña: "clave12345",
		nombre: "probandotest",
		codigoPais: "+598",
		telefono: "099123456",
		...sobrescribir,
	};
}

describe("validar alta de productor", () => {
	it("acepta datos válidos", () => {
		const resultado = validarAltaProductor(armarDatos());

		expect(resultado.esValido).toBe(true);
	});

	it("devuelve error cuando los datos no son un objeto", () => {
		const resultado = validarAltaProductor(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos del productor no son válidos."],
		});
	});

	it("rechaza el alta cuando falta el rol", () => {
		const resultado = validarAltaProductor(armarDatos({ rol: "" }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El rol no es válido.");
	});

	it("rechaza el alta cuando el rol no es productor", () => {
		const resultado = validarAltaProductor(armarDatos({ rol: "operador" }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El rol no es válido.");
	});

	it("rechaza el alta cuando falta el nombre de usuario", () => {
		const resultado = validarAltaProductor(armarDatos({ nombreUsuario: "" }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El nombre de usuario debe tener al menos 3 caracteres.");
	});

	it("rechaza un nombre de usuario con solo espacios", () => {
		const resultado = validarAltaProductor(armarDatos({ nombreUsuario: "   " }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El nombre de usuario debe tener al menos 3 caracteres.");
	});

	it("rechaza el alta cuando falta la contraseña", () => {
		const resultado = validarAltaProductor(
			armarDatos({ contraseña: "", confirmacionContraseña: "" }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("La contraseña debe tener al menos 8 caracteres.");
	});

	it("rechaza una contraseña de menos de 8 caracteres", () => {
		const resultado = validarAltaProductor(
			armarDatos({ contraseña: "corta12", confirmacionContraseña: "corta12" }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("La contraseña debe tener al menos 8 caracteres.");
	});

	it("rechaza el alta cuando la contraseña no llega como texto", () => {
		const resultado = validarAltaProductor(armarDatos({ contraseña: undefined }));

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos del productor no son válidos."],
		});
	});

	it("rechaza el alta cuando falta la confirmación de contraseña", () => {
		const resultado = validarAltaProductor(armarDatos({ confirmacionContraseña: undefined }));

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos del productor no son válidos."],
		});
	});

	it("rechaza el alta cuando las contraseñas no coinciden", () => {
		const resultado = validarAltaProductor(
			armarDatos({ confirmacionContraseña: "otraclave123" }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("Las contraseñas no coinciden.");
	});

	it("rechaza el alta cuando falta el nombre del productor", () => {
		const resultado = validarAltaProductor(armarDatos({ nombre: "" }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El nombre es obligatorio.");
	});

	it("rechaza el alta cuando falta el código de país", () => {
		const resultado = validarAltaProductor(armarDatos({ codigoPais: "" }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El código de país no es válido.");
	});

	it("rechaza el alta cuando falta el teléfono", () => {
		const resultado = validarAltaProductor(armarDatos({ telefono: "" }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El teléfono no es válido.");
	});

	it("arma el teléfono con el código de país y sin el cero inicial", () => {
		const resultado = validarAltaProductor(armarDatos({ telefono: "099 123-456" }));

		expect(resultado.esValido).toBe(true);
		if (!resultado.esValido) return;
		expect(resultado.datos.telefono).toBe("+59899123456");
	});

	it("devuelve los datos cuando todo es válido", () => {
		const resultado = validarAltaProductor(
			armarDatos({
				nombreUsuario: "  juan  ",
				nombre: "  Frutas Juan  ",
				telefono: "099123456",
			}),
		);

		expect(resultado).toEqual({
			esValido: true,
			datos: {
				nombreUsuario: "juan",
				contraseña: "clave12345",
				nombre: "Frutas Juan",
				telefono: "+59899123456",
			},
		});
	});
});