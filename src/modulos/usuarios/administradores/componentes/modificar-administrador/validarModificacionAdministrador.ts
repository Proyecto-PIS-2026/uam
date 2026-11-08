export type DatosModificacionAdministrador = {
    administradorId: number;
    nombreUsuario: string;
    contraseña: string | null;
};

export type ResultadoValidacionModificacionAdministrador =
    | { esValido: true; datos: DatosModificacionAdministrador }
    | { esValido: false; errores: string[] };

const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");

export function validarModificacionAdministrador(valor: unknown): ResultadoValidacionModificacionAdministrador {
    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
        return { esValido: false, errores: ["Los datos del administrador no son válidos."] };
    }

    const datos = valor as Record<string, unknown>;
    const errores: string[] = [];

    const administradorId = datos.administradorId;
    const nombreUsuario = texto(datos.nombreUsuario);
    const contraseña = typeof datos.contraseña === "string" ? datos.contraseña : "";
    const confirmacion = typeof datos.confirmacionContraseña === "string" ? datos.confirmacionContraseña : "";

    if (typeof administradorId !== "number" || !Number.isSafeInteger(administradorId) || administradorId <= 0) {
        errores.push("El administrador no es válido.");
    }

    if (!nombreUsuario) {
        errores.push("El nombre es obligatorio.");
    } else if (nombreUsuario.length < 3) {
        errores.push("El nombre de usuario debe tener al menos 3 caracteres.");
    }

    if (contraseña || confirmacion) {
        if (contraseña.length < 8) errores.push("La contraseña debe tener al menos 8 caracteres.");
        if (contraseña !== confirmacion) errores.push("Las contraseñas no coinciden.");
    }

    if (errores.length > 0) {
        return { esValido: false, errores };
    }

    return {
        esValido: true,
        datos: {
            administradorId: administradorId as number,
            nombreUsuario,
            contraseña: contraseña || null,
        },
    };
}
