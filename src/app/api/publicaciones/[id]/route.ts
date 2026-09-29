import { NextResponse } from "next/server";
import { bajaPublicacionOperador } from "@/modulos/publicaciones/bajaPublicacionOperador";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { obtenerOperadorActual, obtenerOperadorPorId } from "@/modulos/usuarios/operadores/operador-actual";
import { ErrorEdicionPublicacion, modificarPublicacionOperador, type CambiosPublicacionOperador } from "@/modulos/publicaciones/operadores/modificar-publicacion";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

type Contexto = { params: Promise<{ id: string }> };

function leerOperadorId(solicitud: Request): number | null | undefined {
	const valores = new URL(solicitud.url).searchParams.getAll("operadorId");
	if (valores.length === 0) return undefined;
	if (valores.length !== 1 || !/^[1-9]\d*$/.test(valores[0])) return null;
	const operadorId = Number(valores[0]);
	return Number.isSafeInteger(operadorId) ? operadorId : null;
}

function actualizarVistas(operador: { nombreFantasia: string }) {
	revalidatePath("/mi-mercado");
	revalidatePath(`/mi-mercado/${encodeURIComponent(operador.nombreFantasia)}`);
	revalidatePath("/publicaciones");
	revalidatePath(`/operadores/${encodeURIComponent(operador.nombreFantasia)}`);
	revalidatePath("/operadores");
	revalidatePath("/inicio");
}

export async function DELETE(solicitud: Request, contexto: Contexto) {
	const { id: identificador } = await contexto.params;
	const publicacionId = Number(identificador);
	if (!Number.isSafeInteger(publicacionId) || publicacionId <= 0) {
		return NextResponse.json({ errores: ["La publicación o el operador no son válidos."] }, { status: 400 });
	}
	const operadorId = leerOperadorId(solicitud);
	if (operadorId === null) {
		return NextResponse.json({ errores: ["El operador no es válido."] }, { status: 400 });
	}

	try {
		const operador = operadorId === undefined
			? await obtenerOperadorActual()
			: await obtenerOperadorPorId(operadorId);
		if (!operador) {
			return NextResponse.json({ errores: ["No se encontró el operador seleccionado."] }, { status: 404 });
		}
		const eliminada = await bajaPublicacionOperador(publicacionId, operador.id);
		if (!eliminada) return NextResponse.json({ errores: ["La publicación no pertenece al operador seleccionado."] }, { status: 404 });
		actualizarVistas(operador);
		return NextResponse.json({ mensaje: "Publicación eliminada." });
	} catch (error) {
		console.error("Error al eliminar publicación:", error);
		return NextResponse.json({ errores: ["No se pudo eliminar la publicación."] }, { status: 500 });
	}
}

export async function PATCH(solicitud: Request, contexto: Contexto) {
	const { id: identificador } = await contexto.params;
	const publicacionId = Number(identificador);
	if (!Number.isSafeInteger(publicacionId) || publicacionId <= 0) {
		return NextResponse.json({ errores: ["La publicación no es válida."] }, { status: 400 });
	}
	const operadorId = leerOperadorId(solicitud);
	if (operadorId === null) {
		return NextResponse.json({ errores: ["El operador no es válido."] }, { status: 400 });
	}

	let cambios: unknown;
	let fotoNueva: File | null = null;
	try {
		const formulario = await solicitud.formData();
		const datos = formulario.get("cambios");
		if (typeof datos !== "string") {
			return NextResponse.json({ errores: ["Los cambios no son válidos."] }, { status: 400 });
		}
		cambios = JSON.parse(datos);
		const fotografia = formulario.get("fotografia");
		if (typeof fotografia === "string") {
			return NextResponse.json({ errores: ["La fotografía no es válida."] }, { status: 400 });
		}
		fotoNueva = fotografia;
	} catch {
		return NextResponse.json({ errores: ["No se pudieron leer los cambios de la publicación."] }, { status: 400 });
	}

	if (typeof cambios !== "object" || cambios === null || Array.isArray(cambios)) {
		return NextResponse.json({ errores: ["Los cambios no son válidos."] }, { status: 400 });
	}
	const datos = cambios as Record<string, unknown>;
	const identificadores = [datos.presentacionId, datos.categoriaId, datos.calibreId, datos.paisId];
	if (identificadores.some((id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) ||
		(datos.foto !== null && typeof datos.foto !== "string")) {
		return NextResponse.json({ errores: ["Los cambios no son válidos."] }, { status: 400 });
	}

	try {
		const operador = operadorId === undefined
			? await obtenerOperadorActual()
			: await obtenerOperadorPorId(operadorId);
		if (!operador) {
			return NextResponse.json({ errores: ["No se encontró el operador seleccionado."] }, { status: 404 });
		}
		const vinculo = await db.orm.public.PublicacionOperador
			.select("id")
			.where({ publicacionId, operadorId: operador.id })
			.first();
		if (!vinculo) {
			return NextResponse.json({ errores: ["La publicación no pertenece al operador seleccionado."] }, { status: 404 });
		}
		const resultado = await modificarPublicacionOperador(operador.usuarioId, vinculo.id, cambios as CambiosPublicacionOperador, fotoNueva);
		actualizarVistas(operador);
		return NextResponse.json({ ...resultado, mensaje: "Publicación modificada correctamente." });
	} catch (error) {
		if (error instanceof ErrorEdicionPublicacion) {
			return NextResponse.json({ errores: [error.message] }, { status: error.codigo === "NO_ENCONTRADA" ? 404 : 400 });
		}
		console.error("Error al modificar publicación:", error);
		return NextResponse.json({ errores: ["No se pudo modificar la publicación."] }, { status: 500 });
	}
}
