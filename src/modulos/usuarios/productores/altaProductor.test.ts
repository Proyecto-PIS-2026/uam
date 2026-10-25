import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { altaProductor } from "./altaProductor";

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ exigirAdministrador: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const identificador = randomUUID().replaceAll("-", "").slice(0, 10);
const nombreUsuarioPrueba = `productor_${identificador}`;
const nombrePrueba = `Productor prueba ${identificador}`;
const usuariosDePrueba = new Set<string>();

function armarDatos(sobrescribir: Record<string, unknown> = {}) {
	const datos = {
		rol: "productor",
		nombreUsuario: nombreUsuarioPrueba,
		contraseña: "clave12345",
		confirmacionContraseña: "clave12345",
		nombre: nombrePrueba,
		codigoPais: "+598",
		telefono: "099123456",
		...sobrescribir,
	};
	usuariosDePrueba.add(String(datos.nombreUsuario));
	return datos;
}

async function borrarAlta(productorId: number) {
	const productor = await db.orm.public.Productor.where({ id: productorId }).first();
	await db.orm.public.Productor.where({ id: productorId }).delete();
	if (productor) await db.orm.public.Usuario.where({ id: productor.usuarioId }).delete();
}

describe("alta de productor", () => {
	afterEach(async () => {
		for (const username of usuariosDePrueba) {
			const usuario = await db.orm.public.Usuario.where({ username }).first();
			if (!usuario) continue;
			const productor = await db.orm.public.Productor.where({ usuarioId: usuario.id }).first();
			if (productor) await borrarAlta(productor.id);
			else await db.orm.public.Usuario.where({ id: usuario.id }).delete();
		}
		usuariosDePrueba.clear();
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
			expect(productor.nombreFantasia).toBe(nombrePrueba);
			expect(productor.whatsApp).toBe("+59899123456");

			const usuario = await db.orm.public.Usuario.where({ id: productor.usuarioId }).first();
			expect(usuario).toBeTruthy();
			expect(usuario?.username).toBe(nombreUsuarioPrueba);
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
			const segundoResultado = await altaProductor(armarDatos({ nombre: `Otro productor ${identificador}` }));

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
			const segundoResultado = await altaProductor(armarDatos({ nombreUsuario: `${nombreUsuarioPrueba}_otro` }));

			expect(segundoResultado).toEqual({
				esValido: false,
				errores: ["Ya existe un productor con ese nombre."],
			});
		} finally {
			await borrarAlta(primerResultado.id);
		}
	});
});
