import { describe, expect, it } from "vitest";
import { db } from "../../infraestructura/persistencia/prisma/db";
import { altaPublicacionOperador } from "./altaPublicacionOperador";

describe("alta de publicación de operador", () => {
	it("rechaza una publicación duplicada sin crear otro registro", async () => {
		const [relacion] = await db.orm.public.PublicacionOperador.all();
		if (!relacion) throw new Error("El test necesita una publicación de operador cargada por el seed.");

		const publicacion = await db.orm.public.Publicacion.where({ id: relacion.publicacionId }).first();
		if (!publicacion) throw new Error("La publicación del seed no existe.");

		const presentacion = await db.orm.public.Presentacion.where({ id: publicacion.presentacionId }).first();
		if (!presentacion) throw new Error("La presentación del seed no existe.");

		const variedad = await db.orm.public.Variedad.where({ id: presentacion.variedadId }).first();
		if (!variedad) throw new Error("La variedad del seed no existe.");

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
