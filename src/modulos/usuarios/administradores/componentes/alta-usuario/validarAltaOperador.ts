export type DatosAltaOperador = {
	nombreUsuario: string;
	contraseña: string;
	nombre: string;
	telefono: string;
	locales: { nombre: string; naveId: number; contrato: string }[];
};


export type ResultadoValidacion =
	| { esValido: true; datos: DatosAltaOperador }
	| { esValido: false; errores: string[] };

const CODIGOS_PAIS = ["+598", "+54", "+55", "+56", "+595"];

const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");

export function validarAltaOperador(valor: unknown): ResultadoValidacion {
    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
		return { esValido: false, errores: ["Los datos del operador no son válidos."] };
	}

    const datos = valor as Record<string,unknown>;
    const errores: string[]=[];

    const nombreUsuario = texto(datos.nombreUsuario);
	const contraseña = datos.contraseña;
    const confirmacion = datos.confirmacionContraseña;      
	const nombre = texto(datos.nombre);
	const codigoPais = texto(datos.codigoPais);
    const numeroSinCodigo = texto(datos.telefono).replace(/[\s-]/g, "").replace(/^0+/, "");
    const telefono = codigoPais + numeroSinCodigo;

    if (typeof contraseña !== "string" || typeof confirmacion !== "string") {
        return { esValido: false, errores: ["Los datos del operador no son válidos."] };
    }

    if (datos.rol !== "operador") errores.push("El rol no es válido.");
	if (nombreUsuario.length < 3) errores.push("El nombre de usuario debe tener al menos 3 caracteres.");
	if (contraseña.length < 8) errores.push("La contraseña debe tener al menos 8 caracteres.");
	if (contraseña !== confirmacion) errores.push("Las contraseñas no coinciden.");
	if (!nombre) errores.push("El nombre es obligatorio.");
	if (!CODIGOS_PAIS.includes(codigoPais)) errores.push("El código de país no es válido.");
    if (!/^\d{7,12}$/.test(numeroSinCodigo)) errores.push("El teléfono no es válido.");

    const localesCrudos = Array.isArray(datos.locales) ? datos.locales : [];
    if (localesCrudos.length < 1) errores.push("Debe haber al menos un local.");

    const locales = localesCrudos.map((local, i) => {
        const l = (typeof local === "object" && local !== null ? local : {}) as Record<string, unknown>;
        const nombreLocal = texto(l.nombre);
		const contrato = texto(l.contrato);
		const naveId = l.naveId;

        if (!nombreLocal) errores.push(`Local ${i + 1}: falta el nombre.`);
		if (contrato) {
            try {
                Temporal.PlainDate.from(contrato);
            } catch {
                errores.push(`Local ${i + 1}: la fecha de fin de contrato no es válida.`);
            }
        }
		if (typeof naveId !== "number" || !Number.isSafeInteger(naveId) || naveId <= 0) {
			errores.push(`Local ${i + 1}: seleccioná una nave.`);
		}
		    return { nombre: nombreLocal, naveId: naveId as number, contrato };
	});
    
    const clavesVistas = new Set<string>();
        locales.forEach((local, i) => {
        const clave = `${local.naveId}|${local.nombre}`;            
        if (clavesVistas.has(clave)) {
            errores.push(`Local ${i + 1}: está repetido en el formulario (mismo número en la misma nave).`);
        }
            clavesVistas.add(clave);
    });

    if (errores.length > 0) {
        return { esValido: false, errores };
    }

	return { esValido: true, datos: { nombreUsuario, contraseña, nombre, telefono, locales } };

}