import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { bajaProductor } from "./bajaProductor";
import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";


type PrecioPublicacion = Parameters<
	typeof db.orm.public.Publicacion.create
>[0]["precio"];

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
	exigirAdministrador: vi.fn(),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

describe("baja de productor", () => {
	beforeEach(async () => {
		const usuario = await db.orm.public.Usuario.where({
			username: "bajaproductor_test",
		}).first();

		if (!usuario) return;

		const productor = await db.orm.public.Productor.where({
			usuarioId: usuario.id,
		}).first();

		if (productor) {
			const relaciones = await db.orm.public.PublicacionProductor.where({
				productorId: productor.id,
			}).all();

			for (const relacion of relaciones) {
				await db.orm.public.Publicacion.where({
					id: relacion.publicacionId,
				}).delete();
			}

			await db.orm.public.PublicacionProductor.where({
				productorId: productor.id,
			}).deleteAll();

			await db.orm.public.Productor.where({
				id: productor.id,
			}).delete();
		}

		await db.orm.public.Usuario.where({
			id: usuario.id,
		}).delete();
	});

	it("devuelve los errores del validador cuando los datos son inválidos", async () => {
		const resultado = await bajaProductor(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos de la baja no son válidos."],
		});
	});

	it("elimina correctamente el productor y su usuario", async () => {
		const usuario = await db.orm.public.Usuario.create({
			username: "bajaproductor_test",
			passwordHash: "password-test",
			rol: "PRODUCTOR",
		});

		const productor = await db.orm.public.Productor.create({
			usuarioId: usuario.id,
			nombreFantasia: "Productor Baja Test",
			whatsApp: "099123456",
		});

		const resultado = await bajaProductor({
			productorId: productor.id,
		});

		expect(resultado).toEqual({
			esValido: true,
			mensaje: "Productor eliminado correctamente.",
		});

		const productorEliminado = await db.orm.public.Productor.where({
			id: productor.id,
		}).first();

		const usuarioEliminado = await db.orm.public.Usuario.where({
			id: usuario.id,
		}).first();

		expect(productorEliminado).toBeNull();
		expect(usuarioEliminado).toBeNull();
	});

	it("elimina las publicaciones y sus relaciones al dar de baja al productor", async () => {
		const usuario = await db.orm.public.Usuario.create({
			username: "bajaproductor_test",
			passwordHash: "password-test",
			rol: "PRODUCTOR",
		});

		const productor = await db.orm.public.Productor.create({
			usuarioId: usuario.id,
			nombreFantasia: "Productor Baja Test",
			whatsApp: "099123456",
		});

		const calibre = (await db.orm.public.Calibre.all())[0];
		const categoria = (await db.orm.public.Categoria.all())[0];
		const presentacion = (await db.orm.public.Presentacion.all())[0];
		const pais = (await db.orm.public.Pais.all())[0];

		if (!calibre || !categoria || !presentacion || !pais) {
			throw new Error(
				"Faltan datos de referencia para crear la publicación de prueba."
			);
		}

        const precio = "100.00" as unknown as PrecioPublicacion;

        const publicacion = await db.orm.public.Publicacion.create({
            calibreId: calibre.id,
            categoriaId: categoria.id,
            fecha: Temporal.Instant.fromEpochMilliseconds(
                new Date("2026-10-03T15:00:00.000Z").getTime()
            ),
            foto: null,
            precio,
            presentacionId: presentacion.id,
            publicacionActiva: true,
            publicacionDisponible: true,
            tipoPublicacion: "PRODUCTOR",
            cantidadUnidades: 10,
        });

		await db.orm.public.PublicacionProductor.create({
			productorId: productor.id,
			publicacionId: publicacion.id,
			paisId: pais.id,
		});

		const resultado = await bajaProductor({
			productorId: productor.id,
		});

		expect(resultado).toEqual({
			esValido: true,
			mensaje: "Productor eliminado correctamente.",
		});

		const publicacionEliminada = await db.orm.public.Publicacion.where({
			id: publicacion.id,
		}).first();

		const relacionEliminada =
			await db.orm.public.PublicacionProductor.where({
				publicacionId: publicacion.id,
			}).first();

		expect(publicacionEliminada).toBeNull();
		expect(relacionEliminada).toBeNull();
	});

	it("rechaza la baja cuando el productor no existe", async () => {
		const resultado = await bajaProductor({
			productorId: 999999999,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El productor seleccionado ya no existe."],
		});
	});
});