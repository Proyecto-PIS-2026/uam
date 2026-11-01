export type DatosCambioContrasena = {
    contrasenaActual: string;
    nuevaContrasena: string;
    confirmacionContrasena: string;
};

export type ResultadoValidacionCambioContrasena =
    | { esValido: true; datos: DatosCambioContrasena }
    | { esValido: false; errores: string[] };

export function validarCambioContrasena(
    valor: unknown,
): ResultadoValidacionCambioContrasena {
    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
        return {
            esValido: false,
            errores: ["Los datos de la contraseña no son válidos."],
        };
    }

    const datos = valor as Record<string, unknown>;
    const contrasenaActual =
        typeof datos.contrasenaActual === "string" ? datos.contrasenaActual : "";
    const nuevaContrasena =
        typeof datos.nuevaContrasena === "string" ? datos.nuevaContrasena : "";
    const confirmacionContrasena =
        typeof datos.confirmacionContrasena === "string"
            ? datos.confirmacionContrasena
            : "";
    const errores: string[] = [];

    if (!contrasenaActual) errores.push("Ingresá tu contraseña actual.");
    if (!nuevaContrasena) {
        errores.push("Ingresá una nueva contraseña.");
    } else if (nuevaContrasena.length < 8) {
        errores.push("La nueva contraseña debe tener al menos 8 caracteres.");
    }
    if (nuevaContrasena !== confirmacionContrasena) {
        errores.push("Las contraseñas nuevas no coinciden.");
    }

    if (errores.length) return { esValido: false, errores };

    return {
        esValido: true,
        datos: { contrasenaActual, nuevaContrasena, confirmacionContrasena },
    };
}
