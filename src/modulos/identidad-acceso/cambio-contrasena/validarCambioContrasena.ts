export function validarCambioContrasena(valor: unknown) {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
        return { esValido: false as const, errores: ["Los datos no son válidos."] };
    }
    const { actual, nueva, confirmacion } = valor as Record<string, unknown>;
    const errores: string[] = [];
    if (typeof actual !== "string" || actual.length === 0) errores.push("Ingresá tu contraseña actual.");
    if (typeof nueva !== "string" || nueva.length < 8) errores.push("La nueva contraseña debe tener al menos 8 caracteres.");
    if (typeof confirmacion !== "string" || confirmacion !== nueva) errores.push("La confirmación de la nueva contraseña no coincide.");
    if (errores.length) return { esValido: false as const, errores };
    return { esValido: true as const, datos: { actual: actual as string, nueva: nueva as string } };
}
