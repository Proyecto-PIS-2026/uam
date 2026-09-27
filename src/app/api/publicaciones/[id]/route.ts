import { NextResponse } from "next/server";
import { bajaPublicacionOperador } from "@/modulos/publicaciones/bajaPublicacionOperador";

export async function DELETE(solicitud: Request, contexto: { params: Promise<{ id: string }> }) {
	const { id: identificador } = await contexto.params;
	const publicacionId = Number(identificador);
	const operadorId = Number(new URL(solicitud.url).searchParams.get("operadorId"));
	if (!Number.isSafeInteger(publicacionId) || publicacionId <= 0 ||
		!Number.isSafeInteger(operadorId) || operadorId <= 0) {
		return NextResponse.json({ errores: ["La publicación o el operador no son válidos."] }, { status: 400 });
	}

	try {
		const eliminada = await bajaPublicacionOperador(publicacionId, operadorId);
		if (!eliminada) return NextResponse.json({ errores: ["La publicación no pertenece al operador seleccionado."] }, { status: 404 });
		return NextResponse.json({ mensaje: "Publicación eliminada." });
	} catch (error) {
		console.error("Error al eliminar publicación:", error);
		return NextResponse.json({ errores: ["No se pudo eliminar la publicación."] }, { status: 500 });
	}
}
