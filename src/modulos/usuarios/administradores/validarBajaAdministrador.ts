export type DatosBajaAdministrador = {
	administradorId: number;
};

export type ResultadoValidacionBajaAdministrador =
	| { esValido: true; datos: DatosBajaAdministrador }
	| { esValido: false; errores: string[] };

export function validarBajaAdministrador(valor: unknown): ResultadoValidacionBajaAdministrador {
	if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
		return { esValido: false, errores: ["Los datos de la baja no son válidos."] };
	}

	const { administradorId } = valor as Record<string, unknown>;

	if (typeof administradorId !== "number" || !Number.isSafeInteger(administradorId) || administradorId <= 0) {
		return { esValido: false, errores: ["El administrador seleccionado no es válido."] };
	}

	return { esValido: true, datos: { administradorId } };
}