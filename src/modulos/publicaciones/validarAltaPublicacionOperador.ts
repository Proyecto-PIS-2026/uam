export type DatosAltaPublicacionOperador = {
	operadorId: number;
	especieId: number;
	variedadId: number;
	presentacionId: number;
	calibreId: number;
	categoriaId: number;
	paisId: number;
	disponibilidad: boolean;
	precio?: string;
	fotografia?: string;
};

export type ResultadoValidacion =
	| { esValido: true; datos: DatosAltaPublicacionOperador }
	| { esValido: false; errores: string[] };

export function validarAltaPublicacionOperador(valor: unknown): ResultadoValidacion {
	if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
		return { esValido: false, errores: ["Los datos de la publicación no son válidos."] };
	}

	const datos = valor as Record<string, unknown>;
	const errores: string[] = [];
	const campos = ["operadorId", "especieId", "variedadId", "presentacionId", "calibreId", "categoriaId", "paisId"] as const;

	for (const campo of campos) {
		if (typeof datos[campo] !== "number" || !Number.isSafeInteger(datos[campo]) || datos[campo] <= 0) {
			errores.push(`El campo ${campo} es obligatorio.`);
		}
	}

	if (typeof datos.disponibilidad !== "boolean") {
		errores.push("La disponibilidad no es válida.");
	}

	if (datos.precio !== undefined && (typeof datos.precio !== "string" ||
		(datos.precio.trim() !== "" && !/^\d{1,10}$/.test(datos.precio.trim())))) {
		errores.push("El precio debe ser un número entero.");
	}

	if (datos.fotografia !== undefined && (typeof datos.fotografia !== "string" ||
		(datos.fotografia !== "" && (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(datos.fotografia) || datos.fotografia.length > 2_800_000)))) {
		errores.push("La fotografía debe ser PNG, JPEG o WebP y pesar menos de 2 MB.");
	}

	if (errores.length > 0) return { esValido: false, errores };
	return { esValido: true, datos: datos as DatosAltaPublicacionOperador };
}
