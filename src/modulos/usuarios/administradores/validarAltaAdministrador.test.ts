
import { describe, expect, it } from "vitest";
import { validarAltaAdministrador } from "./validarAltaAdministrador";

function armarDatos(sobrescribir: Record<string, unknown> = {}) {
	return {
		rol: "administrador",
		nombreUsuario: "adminprueba",
		contraseña: "clave12345",
		confirmacionContraseña: "clave12345",
		email: "adminprueba@example.com",
		...sobrescribir,
	};
}

describe("validar alta de administrador", () => {
	it("acepta datos válidos", () => {
		const resultado = validarAltaAdministrador(armarDatos());

		expect(resultado).toEqual({
			esValido: true,
			datos: {
				nombreUsuario: "adminprueba",
				contraseña: "clave12345",
				email: "adminprueba@example.com",
			},
		});
	});

	it("devuelve error cuando los datos no son un objeto", () => {
		expect(validarAltaAdministrador(null)).toEqual({
			esValido: false,
			errores: ["Los datos del administrador no son válidos."],
		});
	});

	it("rechaza un array como entrada", () => {
		expect(validarAltaAdministrador([])).toEqual({
			esValido: false,
			errores: ["Los datos del administrador no son válidos."],
		});
	});

	it("rechaza el alta cuando falta el rol", () => {
		const resultado = validarAltaAdministrador(armarDatos({ rol: "" }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El rol no es válido.");
	});

	it("rechaza un rol distinto de administrador", () => {
		const resultado = validarAltaAdministrador(armarDatos({ rol: "operador" }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El rol no es válido.");
	});

	it("rechaza el alta cuando falta el nombre de usuario", () => {
		const resultado = validarAltaAdministrador(
			armarDatos({ nombreUsuario: "" }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain(
			"El nombre de usuario debe tener al menos 3 caracteres.",
		);
	});

	it("rechaza un nombre de usuario con solo espacios", () => {
		const resultado = validarAltaAdministrador(
			armarDatos({ nombreUsuario: "   " }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain(
			"El nombre de usuario debe tener al menos 3 caracteres.",
		);
	});

	it("rechaza un nombre de usuario de menos de 3 caracteres", () => {
		const resultado = validarAltaAdministrador(
			armarDatos({ nombreUsuario: "ab" }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain(
			"El nombre de usuario debe tener al menos 3 caracteres.",
		);
	});

	it("rechaza el alta cuando falta la contraseña", () => {
		const resultado = validarAltaAdministrador(
			armarDatos({
				contraseña: "",
				confirmacionContraseña: "",
			}),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain(
			"La contraseña debe tener al menos 8 caracteres.",
		);
	});

	it("rechaza una contraseña de menos de 8 caracteres", () => {
		const resultado = validarAltaAdministrador(
			armarDatos({
				contraseña: "corta12",
				confirmacionContraseña: "corta12",
			}),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain(
			"La contraseña debe tener al menos 8 caracteres.",
		);
	});

	it("rechaza el alta cuando la contraseña no llega como texto", () => {
		const resultado = validarAltaAdministrador(
			armarDatos({ contraseña: undefined }),
		);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos del administrador no son válidos."],
		});
	});

	it("rechaza el alta cuando falta la confirmación de contraseña", () => {
		const resultado = validarAltaAdministrador(
			armarDatos({ confirmacionContraseña: undefined }),
		);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos del administrador no son válidos."],
		});
	});

	it("rechaza el alta cuando las contraseñas no coinciden", () => {
		const resultado = validarAltaAdministrador(
			armarDatos({ confirmacionContraseña: "otraclave123" }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("Las contraseñas no coinciden.");
	});

	it("rechaza el alta cuando falta el email", () => {
		const resultado = validarAltaAdministrador(
			armarDatos({ email: "" }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El email es obligatorio.");
	});

	it.each([
		"correo",
		"correo@",
		"@ejemplo.com",
		"correo@ejemplo",
		"correo con espacios@example.com",
	])("rechaza un email inválido: %s", (email) => {
		const resultado = validarAltaAdministrador(armarDatos({ email }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El email no es válido.");
	});

	it("devuelve los datos normalizados cuando todo es válido", () => {
		const resultado = validarAltaAdministrador(
			armarDatos({
				nombreUsuario: "  juan  ",
				email: "  Juan@Example.com  ",
			}),
		);

		expect(resultado).toEqual({
			esValido: true,
			datos: {
				nombreUsuario: "juan",
				contraseña: "clave12345",
				email: "Juan@Example.com",
			},
		});
	});
});
