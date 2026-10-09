"use server";

import { redirect } from "next/navigation";
import { crearSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { autenticarUsuario } from "@/modulos/identidad-acceso/autenticacion/autenticarUsuario";
import { existeUsuarioPorNombre } from "@/modulos/identidad-acceso/autenticacion/consultasAutenticacion";

export type EstadoInicioSesion = {
    error?: string;
};

export type EstadoRecuperacion = {
    error?: string;
    exito?: string;
};

export async function solicitarRecuperacion(
    nombreUsuario: string,
): Promise<EstadoRecuperacion> {
    const nombreNormalizado = nombreUsuario.trim();
    if (!nombreNormalizado) {
        return { error: "Ingresá tu nombre de usuario para solicitar la recuperación." };
    }

    const usuarioExiste = await existeUsuarioPorNombre(nombreNormalizado);
    if (!usuarioExiste) {
        return { error: "No existe ningún usuario con ese nombre." };
    }

    return {
        exito: "La solicitud de recuperación fue realizada correctamente.",
    };
}

export async function iniciarSesion(
    _estadoAnterior: EstadoInicioSesion,
    datos: FormData,
): Promise<EstadoInicioSesion> {
    const identificador = datos.get("identificador");
    const contrasena = datos.get("contrasena");

    if (
        typeof identificador !== "string" ||
        typeof contrasena !== "string" ||
        !identificador.trim() ||
        !contrasena
    ) {
        return { error: "Ingresá tus credenciales para continuar." };
    }

    const usuario = await autenticarUsuario({
        identificador: identificador.trim(),
        contrasena,
    });

    if (!usuario) {
        return { error: "Las credenciales ingresadas no son correctas." };
    }
    if ("error" in usuario) {
        return {
            error: "No tenés ningún contrato vigente para iniciar sesión. Comunicate con los administradores de la UAM.",
        };
    }

    await crearSesion(usuario.usuarioId, usuario.rol);
    redirect("/");
}
