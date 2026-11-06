"use server";

import { redirect } from "next/navigation";
import { cerrarSesion, crearSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { cancelarSegundoFactor, iniciarSegundoFactor } from "@/modulos/identidad-acceso/autenticacion/segundo-factor";
import { borrarCookieSegundoFactor, guardarCookieSegundoFactor, obtenerTokenSegundoFactor } from "@/modulos/identidad-acceso/autenticacion/cookie-segundo-factor";
import { autenticarUsuario } from "@/modulos/identidad-acceso/autenticacion/autenticarUsuario";
import { existeUsuarioPorNombre } from "@/modulos/identidad-acceso/autenticacion/consultasAutenticacion";
import { obtenerRutaPrincipal } from "@/modulos/identidad-acceso/autorizacion/rutas";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { enviarNotificacion } from "@/modulos/notificaciones/notificaciones";
import { registrarVisita } from "@/modulos/administracion/estadisticas/registrar-estadisticas";
import { estaHabilitadoCambioContrasena } from "@/modulos/identidad-acceso/cambio-contrasena/configuracion";

export type EstadoInicioSesion = {
    error?: string;
};

export type EstadoRecuperacion = {
    error?: string;
    exito?: string;
    tipoError?: "operacion";
};

async function registrarVisitaLogin(tipoVisitante: "OPERADOR" | "PRODUCTOR") {
    try {
        await registrarVisita(tipoVisitante);
    } catch (error) {
        console.error("Error al registrar estadística de visita:", error);
    }
}

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
        if (!await estaHabilitadoCambioContrasena()) {
            return { error: "La recuperación de contraseña no está habilitada por el administrador." };
        }
        const usuarioExiste = await existeUsuarioPorNombre(nombreNormalizado);

        if (!usuarioExiste) {
            return {
                error: "No existe ningún usuario con ese nombre.",
            };
        }

        await db.transaction(async (tx) => {
            // Sólo la primera solicitud pendiente genera un aviso, incluso si llegan varias a la vez.
            const solicitudesNuevas = await tx.orm.public.Usuario
                .where({ username: nombreNormalizado, solicitoRestablecimiento: false })
                .updateAndCount({ solicitoRestablecimiento: true });
            if (solicitudesNuevas === 0) return;

            const nombreEnAviso = nombreNormalizado.length > 160
                ? `${nombreNormalizado.slice(0, 160)}…`
                : nombreNormalizado;
            const { enviadas } = await enviarNotificacion({
                texto: `El usuario ${nombreEnAviso} solicitó restablecer su contraseña.`,
                url: "/administracion#usuarios",
                roles: ["ADMINISTRADOR"],
            }, tx);
            if (enviadas === 0) throw new Error("No hay administradores para recibir la solicitud de recuperación.");
        });

        return {
            exito: "La solicitud de recuperación fue realizada correctamente.",
        };
    } catch {
        return {
            error: "No se pudo registrar la solicitud. Intentá nuevamente.",
            tipoError: "operacion",
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

    await cancelarSegundoFactor(await obtenerTokenSegundoFactor());
    await borrarCookieSegundoFactor();
    if (usuario.rol === "ADMINISTRADOR") {
        await cerrarSesion();
        const resultado = await iniciarSegundoFactor(usuario.usuarioId);
        if ("error" in resultado) return resultado;
        await guardarCookieSegundoFactor(resultado.token);
        redirect("/iniciar-sesion/segundo-factor");
    }
    if (usuario.rol === "OPERADOR" || usuario.rol === "PRODUCTOR") {
        await registrarVisitaLogin(usuario.rol);
    }

    await crearSesion(usuario.usuarioId, usuario.rol);
    redirect(obtenerRutaPrincipal(usuario.rol));
}
