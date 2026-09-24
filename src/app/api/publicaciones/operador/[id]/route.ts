import { NextResponse } from "next/server";
import { db } from "@/infraestructura/persistencia/prisma/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
	const { id } = await context.params;
	const operadorId = Number(id);
	if (!Number.isSafeInteger(operadorId) || operadorId <= 0) {
		return NextResponse.json({ errores: ["El operador no es válido."] }, { status: 400 });
	}

	try {
		const operador = await db.orm.public.Operador.where({ id: operadorId }).first();
		if (!operador) return NextResponse.json({ errores: ["El operador no existe."] }, { status: 404 });

		const relaciones = await db.orm.public.PublicacionOperador.where({ operadorId }).all();
		if (relaciones.length === 0) return NextResponse.json({ publicaciones: [] });

		const ids = relaciones.map((relacion) => relacion.publicacionId);
		const [publicaciones, presentaciones, variedades, especies, categorias, calibres, paises] = await Promise.all([
			db.orm.public.Publicacion
				.where((publicacion) => publicacion.id.in(ids))
				.select("id", "fecha", "publicacionDisponible", "precio", "presentacionId", "categoriaId", "calibreId")
				.all(),
			db.orm.public.Presentacion.select("id", "nombrePresentacion", "variedadId").all(),
			db.orm.public.Variedad.select("id", "nombreVariedad", "especieId").all(),
			db.orm.public.Especie.select("id", "nombreEspecie").all(),
			db.orm.public.Categoria.select("id", "nombreCategoria").all(),
			db.orm.public.Calibre.select("id", "nombreCalibre").all(),
			db.orm.public.Pais.select("id", "nombrePais").all(),
		]);

		const presentacionPorId = new Map(presentaciones.map((item) => [item.id, item]));
		const variedadPorId = new Map(variedades.map((item) => [item.id, item]));
		const especiePorId = new Map(especies.map((item) => [item.id, item]));
		const categoriaPorId = new Map(categorias.map((item) => [item.id, item.nombreCategoria]));
		const calibrePorId = new Map(calibres.map((item) => [item.id, item.nombreCalibre]));
		const paisPorId = new Map(paises.map((item) => [item.id, item.nombrePais]));
		const relacionPorPublicacion = new Map(relaciones.map((item) => [item.publicacionId, item]));

		const resultado = publicaciones.map((publicacion) => {
			const presentacion = presentacionPorId.get(publicacion.presentacionId);
			const variedad = presentacion && variedadPorId.get(presentacion.variedadId);
			const especie = variedad && especiePorId.get(variedad.especieId);
			const relacion = relacionPorPublicacion.get(publicacion.id);
			return {
				id: publicacion.id,
				fecha: publicacion.fecha.toString(),
				especie: especie?.nombreEspecie ?? "Sin especie",
				variedad: variedad?.nombreVariedad ?? "Sin variedad",
				presentacion: presentacion?.nombrePresentacion ?? "Sin presentación",
				categoria: categoriaPorId.get(publicacion.categoriaId) ?? "Sin categoría",
				calibre: calibrePorId.get(publicacion.calibreId) ?? "Sin calibre",
				pais: relacion ? paisPorId.get(relacion.paisId) ?? "Sin país" : "Sin país",
				precio: publicacion.precio === null ? null : String(publicacion.precio),
				disponible: publicacion.publicacionDisponible,
			};
		}).sort((a, b) => b.id - a.id);

		return NextResponse.json({ publicaciones: resultado });
	} catch (error) {
		console.error("Error al listar publicaciones del operador:", error);
		return NextResponse.json({ errores: ["No se pudieron cargar las publicaciones."] }, { status: 500 });
	}
}
