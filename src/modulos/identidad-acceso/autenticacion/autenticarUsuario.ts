import argon2 from "argon2";
import { operadorTieneContratoVigente } from "@/compartido/vigenciaContrato";
import {
    obtenerUsuarioAdministradorPorCorreo,
    obtenerUsuarioOperadorPorNombre,
    obtenerUsuarioProductorPorNombre,
} from "./consultasAutenticacion";

export type Credenciales = {
    identificador: string;
    contrasena: string;
};

export type ResultadoAutenticacion =
    | { usuarioId: number; rol: "ADMINISTRADOR" | "OPERADOR" | "PRODUCTOR" }
    | { error: "SIN_CONTRATO_VIGENTE" }
    | null;

export async function autenticarUsuario(
    credenciales: Credenciales,
): Promise<ResultadoAutenticacion> {
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

    if (usuario.rol === "OPERADOR" && !(await operadorTieneContratoVigente(usuario.id))) {
        return { error: "SIN_CONTRATO_VIGENTE" };
    }

    return { usuarioId: usuario.id, rol: usuario.rol };
}
