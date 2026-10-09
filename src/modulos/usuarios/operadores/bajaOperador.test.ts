import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { bajaOperador } from "./bajaOperador";

describe("baja de operador", () => {
	beforeEach(async () => {
		const usuario = await db.orm.public.Usuario.where({
			username: "bajaprobandotest",
		}).first();

		if (!usuario) return;

		const operador = await db.orm.public.Operador.where({
			usuarioId: usuario.id,
		}).first();

		if (operador) {
			await db.orm.public.Local.where({
				operadorId: operador.id,
			}).delete();

			await db.orm.public.PublicacionOperador.where({
				operadorId: operador.id,
			}).delete();

			await db.orm.public.Operador.where({
				id: operador.id,
			}).delete();
		}

		await db.orm.public.Usuario.where({
			id: usuario.id,
		}).delete();
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
			username: "bajaprobandotest",
			passwordHash: "password-test",
			rol: "OPERADOR",
		});

		const operador = await db.orm.public.Operador.create({
			usuarioId: usuario.id,
			nombreFantasia: "Operador Baja Test",
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
			username: "bajaprobandotest",
			passwordHash: "password-test",
			rol: "OPERADOR",
		});

		const operador = await db.orm.public.Operador.create({
			usuarioId: usuario.id,
			nombreFantasia: "Operador Baja Test",
			whatsApp: "099123456",
		});

		const nave = await db.orm.public.Nave.all().then((naves) => naves[0]);
		expect(nave).toBeDefined();
		if (!nave) return;

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