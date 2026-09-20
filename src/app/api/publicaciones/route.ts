import { NextResponse } from "next/server";

import {altaPublicacionOperador, type ResultadoAltaPublicacion,} 
from "@/modulos/publicaciones/altaPublicacionOperador";

import type { DatosAltaPublicacionOperador, } from "@/modulos/publicaciones/validarAltaPublicacionOperador";

export async function POST(request: Request) {
	let datos: DatosAltaPublicacionOperador;

	try {
		datos = (await request.json()) as DatosAltaPublicacionOperador;
	} catch {
		return NextResponse.json(
			{ errores: ["El cuerpo de la solicitud no es un JSON válido."] },
			{ status: 400 },
		);
	}

	const resultado: ResultadoAltaPublicacion = altaPublicacionOperador(datos);

	if (!resultado.esValido) {
		return NextResponse.json(resultado, { status: 400 });
	}

	return NextResponse.json(resultado);
}
