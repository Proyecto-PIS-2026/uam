export type DatosModificacionAdministrador = {
    administradorId: number;
    nombreUsuario: string;
    email: string;
};

export type ResultadoValidacionModificacionAdministrador =
    | { esValido: true; datos: DatosModificacionAdministrador }
    | { esValido: false; errores: string[] };

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");

export function validarModificacionAdministrador(valor: unknown): ResultadoValidacionModificacionAdministrador {
    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
        return { esValido: false, errores: ["Los datos del administrador no son válidos."] };
    }

    const datos = valor as Record<string, unknown>;
    const errores: string[] = [];

    const administradorId = datos.administradorId;
    const nombreUsuario = texto(datos.nombreUsuario);
    const email = texto(datos.email);

    if (typeof administradorId !== "number" || !Number.isSafeInteger(administradorId) || administradorId <= 0) {
        errores.push("El administrador no es válido.");
    }

    // Misma regla que el alta de usuarios
    if (!nombreUsuario) {
        errores.push("El nombre es obligatorio.");
    } else if (nombreUsuario.length < 3) {
        errores.push("El nombre de usuario debe tener al menos 3 caracteres.");
    }

    if (!email) {
        errores.push("El correo electrónico es obligatorio.");
    } else if (!FORMATO_CORREO.test(email)) {
        errores.push("El correo electrónico no es válido.");
    }

    if (errores.length > 0) {
        return { esValido: false, errores };
    }

    return {
        esValido: true,
        datos: {
            administradorId: administradorId as number,
            nombreUsuario,
            email,
        },
    };
}