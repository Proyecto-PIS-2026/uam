import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "../../infraestructura/persistencia/prisma/db";
import { altaPublicacionOperador } from "./altaPublicacionOperador";

async function obtenerDatosDePublicacionSemilla() {
	const [relacion] = await db.orm.public.PublicacionOperador.all();
	if (!relacion) throw new Error("El test necesita una publicación de operador cargada por el seed.");

	const publicacion = await db.orm.public.Publicacion.where({ id: relacion.publicacionId }).first();
	if (!publicacion) throw new Error("La publicación del seed no existe.");

	if (publicacion.variedadId === null) throw new Error("La publicación del seed no tiene variedad.");
	const variedad = await db.orm.public.Variedad.where({ id: publicacion.variedadId }).first();
	if (!variedad) throw new Error("La variedad del seed no existe.");

	return { relacion, publicacion, variedad };
}

describe.sequential("alta de publicación de operador", { timeout: 15000 }, () => {
	it("devuelve los errores del validador cuando los datos son inválidos", async () => {
		const resultado = await altaPublicacionOperador(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos de la publicación no son válidos."],
		});
	});

	it("rechaza catálogos inactivos", async () => {
		const { relacion, publicacion, variedad } = await obtenerDatosDePublicacionSemilla();
		const inactiva = await db.orm.public.Variedad.create({ especieId: variedad.especieId, nombreVariedad: `Inactiva ${randomUUID()}`, variedadActiva: false });
		
		try {
			const resultado = await altaPublicacionOperador({
				operadorId: relacion.operadorId,
				especieId: variedad.especieId,
				variedadId: inactiva.id,
				envaseId: publicacion.envaseId,
				kilosId: publicacion.kilosId,
				categoriaId: publicacion.categoriaId,
				calibreId: publicacion.calibreId,
				paisId: relacion.paisId,
				disponibilidad: true,
				precio: "999",
				cantidadUnidades: 99999,
			});

			expect(resultado.esValido).toBe(false);

			if (resultado.esValido === false) {
				const tieneErrorDeCatalogo = resultado.errores.some((err: string) => 
					err.includes("ya no están disponibles") || err.includes("inactiv") || err.includes("operador ya tiene")
				);
				expect(tieneErrorDeCatalogo).toBe(true);
			}
		} finally {
			await db.orm.public.Variedad.where({ id: inactiva.id }).delete();
		}
	});

	it("crea una publicación válida y su relación con el operador", async () => {
		const relaciones = await db.orm.public.PublicacionOperador.all();
		const publicaciones = await db.orm.public.Publicacion.all();
		const variedades = await db.orm.public.Variedad.all();
		let datos: Record<string, unknown> | undefined;
		
		for (const relacion of relaciones) {
			const publicacionesDelOperador = publicaciones.filter((publicacion) => relaciones.some((item) =>
				item.operadorId === relacion.operadorId && item.publicacionId === publicacion.id));
			for (const candidata of publicaciones) {
				const variedad = variedades.find((item) => item.id === candidata.variedadId);
				if (!variedad || publicacionesDelOperador.some((publicacion) =>
					publicacion.especieId === candidata.especieId && publicacion.variedadId === candidata.variedadId &&
					publicacion.envaseId === candidata.envaseId && publicacion.kilosId === candidata.kilosId &&
					publicacion.categoriaId === candidata.categoriaId &&
					publicacion.calibreId === candidata.calibreId)) continue;
				datos = {
					operadorId: relacion.operadorId,
					especieId: variedad.especieId,
					variedadId: variedad.id,
					envaseId: candidata.envaseId,
					kilosId: candidata.kilosId,
					categoriaId: candidata.categoriaId,
					calibreId: candidata.calibreId,
					paisId: relacion.paisId,
					disponibilidad: true,
					precio: "999",
					cantidadUnidades: 5,
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
			
			const publicacionCreada = await db.orm.public.Publicacion.where({ id }).first();
			expect(publicacionCreada).not.toBeNull();
			expect(Number(publicacionCreada?.cantidadUnidades)).toBe(5);

			expect(await db.orm.public.PublicacionOperador.where({ publicacionId: id }).first()).not.toBeNull();
		} finally {
			if (id !== undefined) await db.orm.public.Publicacion.where({ id }).delete();
		}
	});

	it("rechaza una publicación duplicada sin crear otro registro", async () => {
		const { relacion, publicacion, variedad } = await obtenerDatosDePublicacionSemilla();
		const publicacionesAntes = await db.orm.public.PublicacionOperador.where({ operadorId: relacion.operadorId }).all();
		const registrosAntes = await db.orm.public.Publicacion.all();
		const resultado = await altaPublicacionOperador({
			operadorId: relacion.operadorId,
			especieId: variedad.especieId,
			variedadId: variedad.id,
			envaseId: publicacion.envaseId,
			kilosId: publicacion.kilosId,
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
			errores: ["Este operador ya tiene una publicación con la misma especie, variedad, envase, kilos, categoría, calibre y país."],
		});
		expect(publicacionesDespues).toHaveLength(publicacionesAntes.length);
		expect(registrosDespues).toHaveLength(registrosAntes.length);
	});
});
