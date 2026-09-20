import {type DatosAltaPublicacionOperador, validarAltaPublicacionOperador} 
from "./validarAltaPublicacionOperador";


export type ResultadoAltaPublicacion =
	| { esValido: false; errores: string[] }
	| { esValido: true; mensaje: string };


export function altaPublicacionOperador(datos: DatosAltaPublicacionOperador): ResultadoAltaPublicacion {
	const validacion = validarAltaPublicacionOperador(datos);

	if (!validacion.esValido) {
		return { esValido: false, errores: validacion.errores };
	}
	// autorizar al Operador desde la sesión del servidor.
	// buscar duplicados por operador, especie, variedad, calibre, categoría y presentación.
	// almacenar la fotografía recibida mediante un servicio de archivos.
	// persistir Publicacion y su relación con el Operador.
	return {
		esValido: true,
		mensaje: "Simulación completada. No se guardó la publicación",
	};
}
