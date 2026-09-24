import { NextResponse } from "next/server";
import { db } from "@/infraestructura/persistencia/prisma/db";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
	const { id } = await context.params;
	const publicacionId = Number(id);
	const operadorId = Number(new URL(request.url).searchParams.get("operadorId"));
	if (!Number.isSafeInteger(publicacionId) || publicacionId <= 0 ||
		!Number.isSafeInteger(operadorId) || operadorId <= 0) {
		return NextResponse.json({ errores: ["La publicación o el operador no son válidos."] }, { status: 400 });
	}

	try {
		const eliminada = await db.transaction(async (tx) => {
			const relacion = await tx.orm.public.PublicacionOperador.where({ publicacionId, operadorId }).first();
			if (!relacion) return false;
			await tx.orm.public.Publicacion.where({ id: publicacionId }).delete();
			return true;
		});
		if (!eliminada) return NextResponse.json({ errores: ["La publicación no pertenece al operador seleccionado."] }, { status: 404 });
		return NextResponse.json({ mensaje: "Publicación eliminada." });
	} catch (error) {
		console.error("Error al eliminar publicación:", error);
		return NextResponse.json({ errores: ["No se pudo eliminar la publicación."] }, { status: 500 });
	}
}
