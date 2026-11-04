import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { bajaOperador } from "./bajaOperador";

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ exigirAdministrador: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("baja de operador", () => {
	const identificador = randomUUID();
	const username = `baja-test-${identificador}`;
	const navesCreadas: number[] = [];

	afterEach(async () => {
		const usuario = await db.orm.public.Usuario.where({
			username,
		}).first();

		if (usuario) {
			const operador = await db.orm.public.Operador.where({ usuarioId: usuario.id }).first();
			if (operador) {
				await db.orm.public.Local.where({ operadorId: operador.id }).deleteAll();
				await db.orm.public.Operador.where({ id: operador.id }).delete();
			}
			await db.orm.public.Usuario.where({ id: usuario.id }).delete();
		}

		for (const id of navesCreadas.splice(0)) {
			await db.orm.public.Nave.where({ id }).delete();
		}
	});

	it("devuelve los errores del validador cuando los datos son inválidos", async () => {
		const resultado = await bajaOperador(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos de la baja no son válidos."],
		});
	});

	it("elimina correctamente el operador y su usuario", async () => {
		const usuario = await db.orm.public.Usuario.create({
			username,
			passwordHash: "password-test",
			rol: "OPERADOR",
		});

		const operador = await db.orm.public.Operador.create({
			usuarioId: usuario.id,
			nombreFantasia: `Operador Baja Test ${identificador}`,
			whatsApp: "099123456",
		});

		const resultado = await bajaOperador({
			operadorId: operador.id,
		});

		expect(resultado).toEqual({
			esValido: true,
			mensaje: "Operador eliminado correctamente.",
		});

		const operadorEliminado = await db.orm.public.Operador.where({
			id: operador.id,
		}).first();

		const usuarioEliminado = await db.orm.public.Usuario.where({
			id: usuario.id,
		}).first();

		expect(operadorEliminado).toBeNull();
		expect(usuarioEliminado).toBeNull();
	});

	it("elimina los locales del operador", async () => {
		const usuario = await db.orm.public.Usuario.create({
			username,
			passwordHash: "password-test",
			rol: "OPERADOR",
		});

		const operador = await db.orm.public.Operador.create({
			usuarioId: usuario.id,
			nombreFantasia: `Operador Baja Test ${identificador}`,
			whatsApp: "099123456",
		});

		const nave = await db.orm.public.Nave.create({ nombreNave: `baja-test-${identificador}` });
		navesCreadas.push(nave.id);

		await db.orm.public.Local.create({
			operadorId: operador.id,
			naveId: nave.id,
			numeroLocal: "998",
			finContrato: null,
		});

		const resultado = await bajaOperador({
			operadorId: operador.id,
		});

		expect(resultado.esValido).toBe(true);

		const local = await db.orm.public.Local.where({
			operadorId: operador.id,
		}).first();

		expect(local).toBeNull();
	});

	it("rechaza la baja cuando el operador no existe", async () => {
		const resultado = await bajaOperador({
			operadorId: 999999999,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El operador seleccionado ya no existe."],
		});
	});
});
