import bcrypt from "bcryptjs";
import {
    obtenerUsuarioAdministradorPorCorreo,
    obtenerUsuarioOperadorPorNombre,
} from "./consultasAutenticacion";

export type Credenciales = {
    identificador: string;
    contrasena: string;
    rol: "OPERADOR" | "ADMINISTRADOR";
};

export async function autenticarUsuario(credenciales: Credenciales) {
    const usuario = credenciales.rol === "OPERADOR"
        ? await obtenerUsuarioOperadorPorNombre(credenciales.identificador)
        : await obtenerUsuarioAdministradorPorCorreo(credenciales.identificador);

    if (!usuario) return null;

    const contrasenaValida = await bcrypt.compare(credenciales.contrasena, usuario.passwordHash);
    if (!contrasenaValida) return null;

    return { usuarioId: usuario.id, rol: credenciales.rol };
}