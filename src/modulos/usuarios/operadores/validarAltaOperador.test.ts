import { describe, expect, it } from "vitest";
import { validarAltaOperador } from "./validarAltaOperador";

function armarDatos(sobrescribir: Record<string, unknown> = {}) {
	return {
		rol: "operador",
		nombreUsuario: "probandotest",
		contraseña: "clave12345",
		confirmacionContraseña: "clave12345",
		nombre: "probandotest",
		codigoPais: "+598",
		telefono: "099123456",
		locales: [{ numeroLocal: "999", naveId: 1, contrato: "2029-02-28" }],
		...sobrescribir,
	};
}

describe("validar alta de operador", () => {
	it("acepta datos válidos", () => {
		const resultado = validarAltaOperador(armarDatos());

		expect(resultado.esValido).toBe(true);
	});

	it("devuelve error cuando los datos no son un objeto", () => {
		const resultado = validarAltaOperador(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos del operador no son válidos."],
		});
	});

	it("rechaza el alta cuando falta el rol", () => {
		const resultado = validarAltaOperador(armarDatos({ rol: "" }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El rol no es válido.");
	});

	it("rechaza el alta cuando falta el nombre de usuario", () => {
		const resultado = validarAltaOperador(armarDatos({ nombreUsuario: "" }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El nombre de usuario debe tener al menos 3 caracteres.");
	});

	it("rechaza un nombre de usuario con solo espacios", () => {
		const resultado = validarAltaOperador(armarDatos({ nombreUsuario: "   " }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El nombre de usuario debe tener al menos 3 caracteres.");
	});

	it("rechaza el alta cuando falta la contraseña", () => {
		const resultado = validarAltaOperador(
			armarDatos({ contraseña: "", confirmacionContraseña: "" }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("La contraseña debe tener al menos 8 caracteres.");
	});

	it("rechaza una contraseña de menos de 8 caracteres", () => {
		const resultado = validarAltaOperador(
			armarDatos({ contraseña: "corta12", confirmacionContraseña: "corta12" }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("La contraseña debe tener al menos 8 caracteres.");
	});

	it("rechaza el alta cuando la contraseña no llega como texto", () => {
		const resultado = validarAltaOperador(armarDatos({ contraseña: undefined }));

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos del operador no son válidos."],
		});
	});

	it("rechaza el alta cuando falta la confirmación de contraseña", () => {
		const resultado = validarAltaOperador(armarDatos({ confirmacionContraseña: undefined }));

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos del operador no son válidos."],
		});
	});

	it("rechaza el alta cuando las contraseñas no coinciden", () => {
		const resultado = validarAltaOperador(
			armarDatos({ confirmacionContraseña: "otraclave123" }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("Las contraseñas no coinciden.");
	});

	it("rechaza el alta cuando falta el nombre del operador", () => {
		const resultado = validarAltaOperador(armarDatos({ nombre: "" }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El nombre es obligatorio.");
	});

	it("rechaza el alta cuando falta el código de país", () => {
		const resultado = validarAltaOperador(armarDatos({ codigoPais: "" }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El código de país no es válido.");
	});

	it("rechaza el alta cuando falta el teléfono", () => {
		const resultado = validarAltaOperador(armarDatos({ telefono: "" }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("El teléfono no es válido.");
	});

	it("arma el teléfono con el código de país y sin el cero inicial", () => {
		const resultado = validarAltaOperador(armarDatos({ telefono: "099 123-456" }));

		expect(resultado.esValido).toBe(true);
		if (!resultado.esValido) return;
		expect(resultado.datos.telefono).toBe("+59899123456");
	});

	it("rechaza el alta cuando no hay ningún local", () => {
		const resultado = validarAltaOperador(armarDatos({ locales: [] }));

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("Debe haber al menos un local.");
	});

	it("rechaza el alta cuando falta el número de local", () => {
		const resultado = validarAltaOperador(
			armarDatos({ locales: [{ numeroLocal: "", naveId: 1, contrato: "" }] }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("Local 1: falta el número.");
	});

	it("rechaza el alta cuando falta la nave del local", () => {
		const resultado = validarAltaOperador(
			armarDatos({ locales: [{ numeroLocal: "999", naveId: 0, contrato: "" }] }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("Local 1: seleccioná una nave.");
	});

	it("acepta que no haya fecha de fin de contrato", () => {
		const resultado = validarAltaOperador(
			armarDatos({ locales: [{ numeroLocal: "999", naveId: 1, contrato: "" }] }),
		);

		expect(resultado.esValido).toBe(true);
	});

	it("rechaza el alta cuando la fecha de fin de contrato no es válida", () => {
		const resultado = validarAltaOperador(
			armarDatos({ locales: [{ numeroLocal: "999", naveId: 1, contrato: "2026-02-30" }] }),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain("Local 1: la fecha de fin de contrato no es válida.");
	});

	it("rechaza el alta cuando hay dos locales iguales en la misma nave", () => {
		const resultado = validarAltaOperador(
			armarDatos({
				locales: [
					{ numeroLocal: "999", naveId: 1, contrato: "" },
					{ numeroLocal: "999", naveId: 1, contrato: "" },
				],
			}),
		);

		expect(resultado.esValido).toBe(false);
		if (resultado.esValido) return;
		expect(resultado.errores).toContain(
			"Local 2: está repetido en el formulario (mismo número en la misma nave).",
		);
	});

	it("acepta el mismo número de local en naves distintas", () => {
		const resultado = validarAltaOperador(
			armarDatos({
				locales: [
					{ numeroLocal: "999", naveId: 1, contrato: "" },
					{ numeroLocal: "999", naveId: 2, contrato: "" },
				],
			}),
		);

		expect(resultado.esValido).toBe(true);
	});

    it("devuelve los datos cuando todo es válido", () => {
        const resultado = validarAltaOperador(
            armarDatos({
                nombreUsuario: "  juan  ",
                nombre: "  Frutas Juan  ",
                telefono: "099123456",
                locales: [{ numeroLocal: " 101 ", naveId: 2, contrato: "2029-02-28" }],
            }),
        );

        expect(resultado).toEqual({
            esValido: true,
            datos: {
                nombreUsuario: "juan",
                contraseña: "clave12345",
                nombre: "Frutas Juan",
                telefono: "+59899123456",
                locales: [{ numeroLocal: "101", naveId: 2, contrato: "2029-02-28" }],
            },
        });
    });
});