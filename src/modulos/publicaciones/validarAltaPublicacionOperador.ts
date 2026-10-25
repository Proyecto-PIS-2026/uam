import { idCatalogoValido, normalizarSeleccionPublicacion, type SeleccionPublicacion } from "./seleccion-publicacion";
import { PRECIO_PUBLICACION_INVALIDO, precioPublicacionValido } from "./precio-publicacion";

export type DatosAltaPublicacionOperador = SeleccionPublicacion & {
	operadorId: number;
	disponibilidad: boolean;
	precio?: string | null;
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
	const seleccion = normalizarSeleccionPublicacion(datos);
	if (!seleccion.esValido) errores.push(...seleccion.errores);
	if (!idCatalogoValido(datos.operadorId)) errores.push("El campo operadorId es obligatorio.");

	if (datos.disponibilidad !== undefined && typeof datos.disponibilidad !== "boolean") {
		errores.push("La disponibilidad no es válida.");
	}

	if (datos.precio !== undefined && !precioPublicacionValido(datos.precio)) {
		errores.push(PRECIO_PUBLICACION_INVALIDO);
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
	if (!seleccion.esValido) return seleccion;
	return { esValido: true, datos: { ...datos, ...seleccion.seleccion, disponibilidad: datos.disponibilidad ?? true } as DatosAltaPublicacionOperador };
}
