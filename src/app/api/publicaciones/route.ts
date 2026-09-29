import { NextResponse } from "next/server";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { altaPublicacionOperador } from "@/modulos/publicaciones/altaPublicacionOperador";
import { obtenerOperadorActual, obtenerOperadorPorId } from "@/modulos/usuarios/operadores/operador-actual";
import { revalidatePath } from "next/cache";

export async function GET() {
	try {
		const [operadores, especies, variedades, presentaciones, categorias, calibres, paises] = await Promise.all([
			db.orm.public.Operador.all(),
			db.orm.public.Especie.all(),
			db.orm.public.Variedad.all(),
			db.orm.public.Presentacion.all(),
			db.orm.public.Categoria.all(),
			db.orm.public.Calibre.all(),
			db.orm.public.Pais.all(),
		]);

		return NextResponse.json({
			operadores: operadores.map(({ id, nombreFantasia }) => ({ id, nombre: nombreFantasia })),
			especies: especies.filter((item) => item.especieActiva).map(({ id, nombreEspecie }) => ({ id, nombre: nombreEspecie })),
			variedades: variedades.filter((item) => item.variedadActiva).map(({ id, especieId, nombreVariedad }) => ({ id, especieId, nombre: nombreVariedad })),
			presentaciones: presentaciones.filter((item) => item.presentacionActiva).map(({ id, variedadId, nombrePresentacion }) => ({ id, variedadId, nombre: nombrePresentacion })),
			categorias: categorias.map(({ id, especieId, nombreCategoria }) => ({ id, especieId, nombre: nombreCategoria })),
			calibres: calibres.map(({ id, nombreCalibre }) => ({ id, nombre: nombreCalibre })),
			paises: paises.map(({ id, nombrePais }) => ({ id, nombre: nombrePais })),
		});
	} catch (error) {
		console.error("Error al cargar catálogos de publicaciones:", error);
		return NextResponse.json({ errores: ["No se pudieron cargar los datos del formulario."] }, { status: 500 });
	}
}

export async function POST(request: Request) {
	let datos: unknown;
	try {
		datos = await request.json();
	} catch {
		return NextResponse.json({ errores: ["El cuerpo de la solicitud no es un JSON válido."] }, { status: 400 });
	}

	let operadorId: number | undefined;
	if (typeof datos === "object" && datos !== null && !Array.isArray(datos) && "operadorId" in datos) {
		const valor = (datos as Record<string, unknown>).operadorId;
		if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor <= 0) {
			return NextResponse.json({ errores: ["El operador no es válido."] }, { status: 400 });
		}
		operadorId = valor;
	}

	try {
		const operador = operadorId === undefined
			? await obtenerOperadorActual()
			: await obtenerOperadorPorId(operadorId);
		if (!operador) {
			return NextResponse.json({ errores: ["No se encontró el operador seleccionado."] }, { status: 404 });
		}
		const datosDelOperador = typeof datos === "object" && datos !== null && !Array.isArray(datos)
			? { ...datos, operadorId: operador.id }
			: datos;
		const resultado = await altaPublicacionOperador(datosDelOperador);
		if (resultado.esValido) {
			revalidatePath("/mi-mercado");
			revalidatePath(`/mi-mercado/${encodeURIComponent(operador.nombreFantasia)}`);
			revalidatePath("/publicaciones");
			revalidatePath(`/operadores/${encodeURIComponent(operador.nombreFantasia)}`);
			revalidatePath("/operadores");
			revalidatePath("/inicio");
		}
		return NextResponse.json(resultado, { status: resultado.esValido ? 201 : 400 });
	} catch (error) {
		console.error("Error al crear publicación:", error);
		return NextResponse.json({ errores: ["No se pudo guardar la publicación."] }, { status: 500 });
	}
}
