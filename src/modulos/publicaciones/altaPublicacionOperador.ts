import { validarCatalogosSeleccion } from "./seleccion-publicacion";
import { db } from "../../infraestructura/persistencia/prisma/db";
import { validarAltaPublicacionOperador } from "./validarAltaPublicacionOperador";
import { normalizarPrecioPublicacion } from "./precio-publicacion";
import { ErrorImagenPublicacion, guardarImagenPublicacion } from "./operadores/imagenes-publicacion";
import { limpiarImagenPublicacionNoReferenciada } from "./operadores/limpiar-imagen-publicacion";
import { notificarCambioPublicacion } from "@/infraestructura/tiempo-real/publicaciones";

export type ResultadoAltaPublicacion =
	| { esValido: false; errores: string[] }
	| { esValido: true; id: number; mensaje: string };

export async function altaPublicacionOperador(valor: unknown): Promise<ResultadoAltaPublicacion> {
	const validacion = validarAltaPublicacionOperador(valor);
	if (!validacion.esValido) return validacion;

	const datos = validacion.datos;
	const [operador, catalogosValidos] = await Promise.all([
		db.orm.public.Operador.where({ id: datos.operadorId }).first(),
		validarCatalogosSeleccion(db, datos),
	]);
	if (!operador || !catalogosValidos) {
		return { esValido: false, errores: ["La selección contiene datos que ya no están disponibles. Actualizá el formulario."] };
	}

	type Precio = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];
	const precio = normalizarPrecioPublicacion(datos.precio) as Precio;
	let imagenCreada: { url: string; publicacionId: number } | undefined;
	let resultado: ResultadoAltaPublicacion;
	try {
		if (datos.fotografia) {
			const plan = db.raw.sql`SELECT nextval(pg_get_serial_sequence('publicacion', 'id'))::int AS id`
				.returnsRow({ id: "pg/int4@1" }).build();
			const [identificador] = await db.runtime().query(plan);
			if (!identificador) throw new Error("No se pudo reservar el identificador de la publicación.");
			const url = await guardarImagenPublicacion(identificador.id, datos.fotografia);
			imagenCreada = { url, publicacionId: identificador.id };
		}
		resultado = await db.transaction(async (tx): Promise<ResultadoAltaPublicacion> => {
			await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ${operador.id})`
				.returnsRow({ locked: "pg/int4@1" }).build());

			const operadorActual = await tx.orm.public.Operador.where({ id: operador.id }).first();
			if (!operadorActual) {
				return { esValido: false, errores: ["El operador ya no existe. No se pudo guardar la publicación."] };
			}

			const relaciones = await tx.orm.public.PublicacionOperador.where({ operadorId: operador.id }).all();
			if (relaciones.length > 0) {
				const ids = new Set(relaciones.filter((relacion) => relacion.paisId === datos.paisId).map((relacion) => relacion.publicacionId));
				const coincidencias = await tx.orm.public.Publicacion.where({
					especieId: datos.especieId,
					variedadId: datos.variedadId,
					presentacionId: datos.presentacionId,
					categoriaId: datos.categoriaId,
					calibreId: datos.calibreId,
				}).select("id").all();
				if (coincidencias.some((publicacion) => ids.has(publicacion.id))) {
					return { esValido: false, errores: ["Este operador ya tiene una publicación con la misma especie, variedad, presentación, categoría, calibre y país."] };
				}
			}

			const publicacion = await tx.orm.public.Publicacion.create({
				...(imagenCreada ? { id: imagenCreada.publicacionId } : {}),
				tipoPublicacion: "OPERADOR",
				publicacionDisponible: datos.disponibilidad,
				precio,
				foto: imagenCreada?.url ?? null,
				cantidadUnidades: datos.cantidadUnidades,
				especieId: datos.especieId,
				variedadId: datos.variedadId,
				presentacionId: datos.presentacionId,
				categoriaId: datos.categoriaId,
				calibreId: datos.calibreId,
			});
			await tx.orm.public.PublicacionOperador.create({
				publicacionId: publicacion.id,
				operadorId: operador.id,
				paisId: datos.paisId,
			});
			await notificarCambioPublicacion(tx, { operadorId: operador.id, publicacionId: publicacion.id });
			return { esValido: true, id: publicacion.id, mensaje: "Publicación creada correctamente." };
		});
	} catch (error) {
		if (imagenCreada) {
			await limpiarImagenPublicacionNoReferenciada(imagenCreada.url, imagenCreada.publicacionId);
		}
		if (error instanceof ErrorImagenPublicacion) return { esValido: false, errores: [error.message] };
		throw error;
	}

	if (!resultado.esValido && imagenCreada) {
		await limpiarImagenPublicacionNoReferenciada(imagenCreada.url, imagenCreada.publicacionId);
	}
	return resultado;
}
