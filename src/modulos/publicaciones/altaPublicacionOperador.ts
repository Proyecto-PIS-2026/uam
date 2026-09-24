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

	return { esValido: true, id, mensaje: "Publicación creada correctamente." };
}
