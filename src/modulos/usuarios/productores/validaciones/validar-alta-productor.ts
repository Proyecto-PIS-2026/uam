export type DatosAltaProductor = {
	nombreUsuario: string;
	contraseña: string;
	nombre: string;
	telefono: string;
};

export type ResultadoValidacionAltaProductor =
	| { esValido: true; datos: DatosAltaProductor }
	| { esValido: false; errores: string[] };

const CODIGOS_PAIS = ["+598", "+54", "+55", "+56", "+595"];
const REGLAS_TELEFONO: Record<string, RegExp> = {
	"+598": /^9\d{7}$/,
	"+54": /^\d{10,11}$/,
	"+55": /^\d{10,11}$/,
	"+56": /^9\d{8}$/,
	"+595": /^9\d{8}$/,
};

const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");

export function validarAltaProductor(valor: unknown): ResultadoValidacionAltaProductor {
	if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
		return { esValido: false, errores: ["Los datos del productor no son válidos."] };
	}

	const datos = valor as Record<string, unknown>;
	const errores: string[] = [];

	const nombreUsuario = texto(datos.nombreUsuario);
	const contraseña = datos.contraseña;
	const confirmacion = datos.confirmacionContraseña;
	const nombre = texto(datos.nombre);
	const codigoPais = texto(datos.codigoPais);
	const numeroSinCodigo = texto(datos.telefono).replace(/[\s().-]/g, "").replace(/^0+/, "");
	const telefono = codigoPais + numeroSinCodigo;

	if (typeof contraseña !== "string" || typeof confirmacion !== "string") {
		return { esValido: false, errores: ["Los datos del productor no son válidos."] };
	}

	if (datos.rol !== "productor") errores.push("El rol no es válido.");
	if (nombreUsuario.length < 3) errores.push("El nombre de usuario debe tener al menos 3 caracteres.");
	if (contraseña.length < 8) errores.push("La contraseña debe tener al menos 8 caracteres.");
	if (contraseña !== confirmacion) errores.push("Las contraseñas no coinciden.");
	if (!nombre) errores.push("El nombre es obligatorio.");
	if (nombre === "." || nombre === "..") errores.push('El nombre no puede ser "." ni "..".');
	if (!CODIGOS_PAIS.includes(codigoPais)) errores.push("El código de país no es válido.");
	const reglaTelefono = REGLAS_TELEFONO[codigoPais];
	if (reglaTelefono && !reglaTelefono.test(numeroSinCodigo)) errores.push("El teléfono no es válido.");

	if (errores.length > 0) {
		return { esValido: false, errores };
	}

	return { esValido: true, datos: { nombreUsuario, contraseña, nombre, telefono } };
}