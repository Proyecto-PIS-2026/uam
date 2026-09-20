export type DatosAltaPublicacionOperador = {
	especie: string;
	variedad: string;
	calibre: string;
	categoria: string;
	presentacion: string;
	disponibilidad: boolean;
	precio?: string;
	fotografia?: string;
};

export type ResultadoValidacion = {
	esValido: boolean;
	errores: string[];
};

export function validarAltaPublicacionOperador(datos: DatosAltaPublicacionOperador): ResultadoValidacion {

	const errores: string[] = [];
	
	const camposObligatorios = [
		["especie", datos.especie],
		["variedad", datos.variedad],
		["calibre", datos.calibre],
		["categoria", datos.categoria],
		["presentacion", datos.presentacion],
	] as const;

	for (const [nombre, valor] of camposObligatorios) {
		if (!valor.trim()) {
			errores.push(`El campo ${nombre} es obligatorio.`);
		}
	}

	if (datos.precio?.trim() && !/^\d+(?:[.,]\d{1,2})?$/.test(datos.precio.trim())) {
		errores.push("El precio debe ser un número con hasta dos decimales.");
	}

	return { esValido: errores.length === 0, errores };
}
