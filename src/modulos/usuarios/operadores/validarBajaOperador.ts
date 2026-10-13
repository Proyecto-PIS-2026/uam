export type DatosBajaOperador = {
	operadorId: number;
};

export type ResultadoValidacionBaja =
	| { esValido: true; datos: DatosBajaOperador }
	| { esValido: false; errores: string[] };

export function validarBajaOperador(valor: unknown): ResultadoValidacionBaja {
	if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
		return { esValido: false, errores: ["Los datos de la baja no son válidos."] };
	}

	const { operadorId } = valor as Record<string, unknown>;

	if (typeof operadorId !== "number" || !Number.isSafeInteger(operadorId) || operadorId <= 0) {
		return { esValido: false, errores: ["El operador seleccionado no es válido."] };
	}

	return { esValido: true, datos: { operadorId } };
}