export type DatosBajaProductor = {
	productorId: number;
};

export type ResultadoValidacionBajaProductor =
	| { esValido: true; datos: DatosBajaProductor }
	| { esValido: false; errores: string[] };

export function validarBajaProductor(valor: unknown): ResultadoValidacionBajaProductor {
	if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
		return { esValido: false, errores: ["Los datos de la baja no son válidos."] };
	}

	const { productorId } = valor as Record<string, unknown>;

	if (typeof productorId !== "number" || !Number.isSafeInteger(productorId) || productorId <= 0) {
		return { esValido: false, errores: ["El productor seleccionado no es válido."] };
	}

	return { esValido: true, datos: { productorId } };
}