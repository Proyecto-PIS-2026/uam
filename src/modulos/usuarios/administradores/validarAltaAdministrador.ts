export type DatosAltaAdministrador = {
	nombreUsuario: string;
	contraseña: string;
	email: string;
};

export type ResultadoValidacionAltaAdministrador =
	| { esValido: true; datos: DatosAltaAdministrador }
	| { esValido: false; errores: string[] };

const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");

export function validarAltaAdministrador(valor: unknown): ResultadoValidacionAltaAdministrador {
	if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
		return { esValido: false, errores: ["Los datos del administrador no son válidos."] };
	}

	const datos = valor as Record<string, unknown>;
	const errores: string[] = [];

	const nombreUsuario = texto(datos.nombreUsuario);
	const contraseña = datos.contraseña;
	const confirmacion = datos.confirmacionContraseña;
	const email = texto(datos.email);

	if (typeof contraseña !== "string" || typeof confirmacion !== "string") {
		return { esValido: false, errores: ["Los datos del administrador no son válidos."] };
	}

	if (datos.rol !== "administrador") errores.push("El rol no es válido.");
	if (nombreUsuario.length < 3) errores.push("El nombre de usuario debe tener al menos 3 caracteres.");
	if (contraseña.length < 8) errores.push("La contraseña debe tener al menos 8 caracteres.");
	if (contraseña !== confirmacion) errores.push("Las contraseñas no coinciden.");
	if (!email) errores.push("El email es obligatorio.");
	else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errores.push("El email no es válido.");

	if (errores.length > 0) {
		return { esValido: false, errores };
	}

	return { esValido: true, datos: { nombreUsuario, contraseña, email } };
}