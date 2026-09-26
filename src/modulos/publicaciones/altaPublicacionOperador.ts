import { db } from "@/infraestructura/persistencia/prisma/db";
import { validarAltaPublicacionOperador } from "./validarAltaPublicacionOperador";

export type ResultadoAltaPublicacion =
	| { esValido: false; errores: string[] }
	| { esValido: true; id: number; mensaje: string };

export async function altaPublicacionOperador(valor: unknown): Promise<ResultadoAltaPublicacion> {
	const validacion = validarAltaPublicacionOperador(valor);
	if (!validacion.esValido) return validacion;

	const datos = validacion.datos;
	const [operador, variedad, presentacion, categoria, calibre, pais] = await Promise.all([
		db.orm.public.Operador.where({ id: datos.operadorId }).first(),
		db.orm.public.Variedad.where({ id: datos.variedadId }).first(),
		db.orm.public.Presentacion.where({ id: datos.presentacionId }).first(),
		db.orm.public.Categoria.where({ id: datos.categoriaId }).first(),
		db.orm.public.Calibre.where({ id: datos.calibreId }).first(),
		db.orm.public.Pais.where({ id: datos.paisId }).first(),
	]);

	if (!operador || !variedad || !presentacion || !categoria || !calibre || !pais ||
		variedad.especieId !== datos.especieId || presentacion.variedadId !== variedad.id ||
		!presentacion.presentacionActiva || !variedad.variedadActiva ||
		(categoria.especieId !== null && categoria.especieId !== datos.especieId)) {
		return { esValido: false, errores: ["La selección contiene datos que ya no están disponibles. Actualizá el formulario."] };
	}

	const especie = await db.orm.public.Especie.where({ id: datos.especieId }).first();
	if (!especie?.especieActiva) {
		return { esValido: false, errores: ["La especie ya no está disponible. Actualizá el formulario."] };
	}

	type Precio = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];
	const precio = (datos.precio?.trim().replace(",", ".") || null) as Precio;
	const id = await db.transaction(async (tx) => {
		// Serializar las altas del mismo operador para que dos envíos simultáneos
		// no pasen ambos la comprobación antes de insertar.
		await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ${operador.id})`
			.returnsRow({ locked: "pg/int4@1" }).build());

		const relaciones = await tx.orm.public.PublicacionOperador.where({ operadorId: operador.id }).all();
		if (relaciones.length > 0) {
			const ids = new Set(relaciones.map((relacion) => relacion.publicacionId));
			const coincidencias = await tx.orm.public.Publicacion.where({
				presentacionId: presentacion.id,
				categoriaId: categoria.id,
				calibreId: calibre.id,
			}).select("id").all();
			if (coincidencias.some((publicacion) => ids.has(publicacion.id))) return null;
		}

		const publicacion = await tx.orm.public.Publicacion.create({
			tipoPublicacion: "OPERADOR",
			publicacionDisponible: datos.disponibilidad,
			precio,
			foto: datos.fotografia || null,
			presentacionId: presentacion.id,
			categoriaId: categoria.id,
			calibreId: calibre.id,
		});
		await tx.orm.public.PublicacionOperador.create({
			publicacionId: publicacion.id,
			operadorId: operador.id,
			paisId: pais.id,
		});
		return publicacion.id;
	});

	if (id === null) {
		return { esValido: false, errores: ["Este operador ya tiene una publicación con la misma especie, variedad, presentación, categoría y calibre."] };
	}

	return { esValido: true, id, mensaje: "Publicación creada correctamente." };
}
