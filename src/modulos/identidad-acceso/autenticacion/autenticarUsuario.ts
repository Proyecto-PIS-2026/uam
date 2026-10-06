import argon2 from "argon2";
import {
    obtenerUsuarioAdministradorPorCorreo,
    obtenerUsuarioOperadorPorNombre,
    obtenerUsuarioProductorPorNombre,
} from "./consultasAutenticacion";

export type Credenciales = {
    identificador: string;
    contrasena: string;
};

export async function autenticarUsuario(credenciales: Credenciales) {
    const usuario =
        (await obtenerUsuarioAdministradorPorCorreo(credenciales.identificador)) ||
        (await obtenerUsuarioOperadorPorNombre(credenciales.identificador)) ||
        (await obtenerUsuarioProductorPorNombre(credenciales.identificador));

    if (
        !usuario ||
        (usuario.rol !== "ADMINISTRADOR" &&
            usuario.rol !== "OPERADOR" &&
            usuario.rol !== "PRODUCTOR")
    ) {
        return null;
    }

    const contrasenaValida = await argon2.verify(
        usuario.passwordHash,
        credenciales.contrasena,
    );
    if (!contrasenaValida) return null;

    return { usuarioId: usuario.id, rol: usuario.rol };
}
