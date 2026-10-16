import { textoOperador, validarDatosOperador, type LocalOperadorValidado } from "./validaciones/validarDatosOperador";

export type DatosAltaOperador = {
    nombreUsuario: string;
    contraseña: string;
    nombre: string;
    telefono: string;
    locales: LocalOperadorValidado[];
};

export type ResultadoValidacion =
    | { esValido: true; datos: DatosAltaOperador }
    | { esValido: false; errores: string[] };

export function validarAltaOperador(valor: unknown): ResultadoValidacion {
    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
        return { esValido: false, errores: ["Los datos del operador no son válidos."] };
    }
    const datos = valor as Record<string, unknown>;
    const errores: string[] = [];
    const nombreUsuario = textoOperador(datos.nombreUsuario);
    const contraseña = datos.contraseña;
    const confirmacion = datos.confirmacionContraseña;
    if (typeof contraseña !== "string" || typeof confirmacion !== "string") {
        return { esValido: false, errores: ["Los datos del operador no son válidos."] };
    }
    if (datos.rol !== "operador") errores.push("El rol no es válido.");
    if (nombreUsuario.length < 3) errores.push("El nombre de usuario debe tener al menos 3 caracteres.");
    if (nombreUsuario.includes("@")) errores.push("El nombre de usuario no puede contener @.");
    if (contraseña.length < 8) errores.push("La contraseña debe tener al menos 8 caracteres.");
    if (contraseña !== confirmacion) errores.push("Las contraseñas no coinciden.");
    const comunes = validarDatosOperador(datos, "numeroLocal", errores);
    if (errores.length) return { esValido: false, errores };
    return { esValido: true, datos: { nombreUsuario, contraseña, ...comunes } };
}
