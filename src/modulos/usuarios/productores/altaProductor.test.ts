import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { altaProductor } from "./altaProductor";

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ exigirAdministrador: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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

async function borrarAlta(productorId: number) {
	const productor = await db.orm.public.Productor.where({ id: productorId }).first();
	await db.orm.public.Productor.where({ id: productorId }).delete();
	if (productor) await db.orm.public.Usuario.where({ id: productor.usuarioId }).delete();
}

describe("alta de productor", () => {
	beforeEach(async () => {
		const usuario = await db.orm.public.Usuario.where({ username: "probandotest" }).first();
		if (!usuario) return;
		const productor = await db.orm.public.Productor.where({ usuarioId: usuario.id }).first();
		if (productor) await borrarAlta(productor.id);
		else await db.orm.public.Usuario.where({ id: usuario.id }).delete();
	});

	it("devuelve los errores del validador cuando los datos son inválidos", async () => {
		const resultado = await altaProductor(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos del productor no son válidos."],
		});
	});

	it("crea el usuario y el productor correctamente", async () => {
		const resultado = await altaProductor(armarDatos());

		expect(resultado.esValido).toBe(true);
		if (!resultado.esValido) return;

		try {
			const productor = await db.orm.public.Productor.where({ id: resultado.id }).first();
			expect(productor).toBeTruthy();
			if (!productor) return;
			expect(productor.nombreFantasia).toBe("probandotest");
			expect(productor.whatsApp).toBe("+59899123456");

			const usuario = await db.orm.public.Usuario.where({ id: productor.usuarioId }).first();
			expect(usuario).toBeTruthy();
			expect(usuario?.username).toBe("probandotest");
			expect(usuario?.rol).toBe("PRODUCTOR");
		} finally {
			await borrarAlta(resultado.id);
		}
	});

	it("rechaza el alta cuando ya existe el nombre de usuario", async () => {
		const primerResultado = await altaProductor(armarDatos());
		expect(primerResultado.esValido).toBe(true);
		if (!primerResultado.esValido) return;

		try {
			const segundoResultado = await altaProductor(armarDatos({ nombre: "otro productor" }));

			expect(segundoResultado).toEqual({
				esValido: false,
				errores: ["Ya existe un usuario con ese nombre de usuario."],
			});
		} finally {
			await borrarAlta(primerResultado.id);
		}
	});

	it("rechaza el alta cuando ya existe un productor con el mismo nombre", async () => {
		const primerResultado = await altaProductor(armarDatos());
		expect(primerResultado.esValido).toBe(true);
		if (!primerResultado.esValido) return;

		try {
			const segundoResultado = await altaProductor(armarDatos({ nombreUsuario: "otro_usuario_test" }));

			expect(segundoResultado).toEqual({
				esValido: false,
				errores: ["Ya existe un productor con ese nombre."],
			});
		} finally {
			await borrarAlta(primerResultado.id);
		}
	});
});