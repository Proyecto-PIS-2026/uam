"use server";

import { redirect } from "next/navigation";
import { crearSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { autenticarUsuario } from "@/modulos/identidad-acceso/autenticacion/autenticarUsuario";
import { existeUsuarioPorNombre } from "@/modulos/identidad-acceso/autenticacion/consultasAutenticacion";
import { obtenerRutaPrincipal } from "@/modulos/identidad-acceso/autorizacion/rutas";
import { db } from "@/infraestructura/persistencia/prisma/db";

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
        return {
            error: "Ingresá tu nombre de usuario para solicitar la recuperación.",
        };
    }

    try {
        const usuarioExiste = await existeUsuarioPorNombre(nombreNormalizado);

        if (!usuarioExiste) {
            return {
                error: "No existe ningún usuario con ese nombre.",
            };
        }

        // Registrar la solicitud en la base de datos.
        await db.orm.public.Usuario
            .where({ username: nombreNormalizado })
            .update({ solicitoRestablecimiento: true });

        return {
            exito: "La solicitud de recuperación fue realizada correctamente.",
        };
    } catch {
        return {
            error: "No se pudo registrar la solicitud. Intentá nuevamente.",
        };
    }
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
    redirect(obtenerRutaPrincipal(usuario.rol));
}