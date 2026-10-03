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
	cantidadUnidades?: number | null;
	fotografia?: string;
};

export type ResultadoValidacion =
	| { esValido: true; datos: DatosAltaPublicacionOperador }
	| { esValido: false; errores: string[] };

const TAMANO_MAXIMO_FOTOGRAFIA = 10 * 1024 * 1024;

function fotografiaValida(fotografia: string): boolean {
	if (fotografia === "") return true;
	const separador = fotografia.indexOf(",");
	if (separador < 0 || !/^data:image\/(?:png|jpeg|webp);base64$/.test(fotografia.slice(0, separador))) return false;

	const contenido = fotografia.slice(separador + 1);
	if (contenido.length === 0 || contenido.length % 4 !== 0 || contenido.length > Math.ceil(TAMANO_MAXIMO_FOTOGRAFIA / 3) * 4) return false;
	if (!/^[A-Za-z0-9+/]+={0,2}$/.test(contenido)) return false;

	const relleno = contenido.endsWith("==") ? 2 : contenido.endsWith("=") ? 1 : 0;
	const tamano = contenido.length / 4 * 3 - relleno;
	return tamano > 0 && tamano <= TAMANO_MAXIMO_FOTOGRAFIA;
}

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

	if (datos.fotografia !== undefined && (typeof datos.fotografia !== "string" || !fotografiaValida(datos.fotografia))) {
		errores.push("La fotografía debe ser PNG, JPEG o WebP y pesar hasta 10 MB.");
	}

	if (datos.cantidadUnidades !== undefined && datos.cantidadUnidades !== null) {
		if (typeof datos.cantidadUnidades !== "number" || !Number.isSafeInteger(datos.cantidadUnidades) || datos.cantidadUnidades < 0 || datos.cantidadUnidades > 2147483647) {
			errores.push("La cantidad de unidades debe ser un número entero entre 0 y 2147483647.");
		}
	}	

	if (errores.length > 0) return { esValido: false, errores };
	return { esValido: true, datos: datos as DatosAltaPublicacionOperador };
}
