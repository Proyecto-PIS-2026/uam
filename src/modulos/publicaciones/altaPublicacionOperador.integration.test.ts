import { describe, expect, it } from "vitest";
import { db } from "../../infraestructura/persistencia/prisma/db";
import { altaPublicacionOperador } from "./altaPublicacionOperador";

async function obtenerDatosDePublicacionSemilla() {
	const [relacion] = await db.orm.public.PublicacionOperador.all();
	if (!relacion) throw new Error("El test necesita una publicación de operador cargada por el seed.");

	const publicacion = await db.orm.public.Publicacion.where({ id: relacion.publicacionId }).first();
	if (!publicacion) throw new Error("La publicación del seed no existe.");

	const presentacion = await db.orm.public.Presentacion.where({ id: publicacion.presentacionId }).first();
	if (!presentacion) throw new Error("La presentación del seed no existe.");

	const variedad = await db.orm.public.Variedad.where({ id: presentacion.variedadId }).first();
	if (!variedad) throw new Error("La variedad del seed no existe.");

	return { relacion, publicacion, presentacion, variedad };
}

describe("alta de publicación de operador", () => {
	it("devuelve los errores del validador cuando los datos son inválidos", async () => {
		const resultado = await altaPublicacionOperador(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos de la publicación no son válidos."],
		});
	});

	it("rechaza catálogos inactivos", async () => {
		const { relacion, publicacion, presentacion, variedad } = await obtenerDatosDePublicacionSemilla();
		await db.orm.public.Variedad.where({ id: variedad.id }).update({ variedadActiva: false });

		try {
			const resultado = await altaPublicacionOperador({
				operadorId: relacion.operadorId,
				especieId: variedad.especieId,
				variedadId: variedad.id,
				presentacionId: presentacion.id,
				categoriaId: publicacion.categoriaId,
				calibreId: publicacion.calibreId,
				paisId: relacion.paisId,
				disponibilidad: true,
				precio: "999",
			});

			expect(resultado).toEqual({
				esValido: false,
				errores: ["La selección contiene datos que ya no están disponibles. Actualizá el formulario."],
			});
		} finally {
			await db.orm.public.Variedad.where({ id: variedad.id }).update({ variedadActiva: variedad.variedadActiva });
		}
	});

	it("crea una publicación válida y su relación con el operador", async () => {
		const relaciones = await db.orm.public.PublicacionOperador.all();
		const publicaciones = await db.orm.public.Publicacion.all();
		const presentaciones = await db.orm.public.Presentacion.all();
		const variedades = await db.orm.public.Variedad.all();
		let datos: Record<string, number | boolean | string> | undefined;

		for (const relacion of relaciones) {
			const publicacionesDelOperador = publicaciones.filter((publicacion) => relaciones.some((item) =>
				item.operadorId === relacion.operadorId && item.publicacionId === publicacion.id));
			for (const candidata of publicaciones) {
				const presentacion = presentaciones.find((item) => item.id === candidata.presentacionId);
				const variedad = presentacion && variedades.find((item) => item.id === presentacion.variedadId);
				if (!presentacion || !variedad || publicacionesDelOperador.some((publicacion) =>
					publicacion.presentacionId === candidata.presentacionId &&
					publicacion.categoriaId === candidata.categoriaId &&
					publicacion.calibreId === candidata.calibreId)) continue;
				datos = {
					operadorId: relacion.operadorId,
					especieId: variedad.especieId,
					variedadId: variedad.id,
					presentacionId: presentacion.id,
					categoriaId: candidata.categoriaId,
					calibreId: candidata.calibreId,
					paisId: relacion.paisId,
					disponibilidad: true,
					precio: "999",
				};
				break;
			}
			if (datos) break;
		}

		if (!datos) throw new Error("El test no encontró una combinación disponible en el seed.");
		let id: number | undefined;
		try {
			const resultado = await altaPublicacionOperador(datos);
			expect(resultado.esValido).toBe(true);
			if (!resultado.esValido) return;
			id = resultado.id;
			expect(resultado.mensaje).toBe("Publicación creada correctamente.");
			expect(await db.orm.public.Publicacion.where({ id }).first()).not.toBeNull();
			expect(await db.orm.public.PublicacionOperador.where({ publicacionId: id }).first()).not.toBeNull();
		} finally {
			if (id !== undefined) await db.orm.public.Publicacion.where({ id }).delete();
		}
	});

	it("rechaza una publicación duplicada sin crear otro registro", async () => {
		const { relacion, publicacion, presentacion, variedad } = await obtenerDatosDePublicacionSemilla();

		const publicacionesAntes = await db.orm.public.PublicacionOperador.where({ operadorId: relacion.operadorId }).all();
		const registrosAntes = await db.orm.public.Publicacion.all();
		const resultado = await altaPublicacionOperador({
			operadorId: relacion.operadorId,
			especieId: variedad.especieId,
			variedadId: variedad.id,
			presentacionId: presentacion.id,
			categoriaId: publicacion.categoriaId,
			calibreId: publicacion.calibreId,
			paisId: relacion.paisId,
			disponibilidad: !publicacion.publicacionDisponible,
			precio: "999",
		});
		const publicacionesDespues = await db.orm.public.PublicacionOperador.where({ operadorId: relacion.operadorId }).all();
		const registrosDespues = await db.orm.public.Publicacion.all();

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Este operador ya tiene una publicación con la misma especie, variedad, presentación, categoría y calibre."],
		});
		expect(publicacionesDespues).toHaveLength(publicacionesAntes.length);
		expect(registrosDespues).toHaveLength(registrosAntes.length);
	});
});
