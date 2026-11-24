"use server";

import { redirect } from "next/navigation";
import { cancelarSegundoFactor, confirmarSegundoFactor } from "@/modulos/identidad-acceso/autenticacion/segundo-factor/segundo-factor";
import { borrarCookieSegundoFactor, obtenerTokenSegundoFactor } from "@/modulos/identidad-acceso/autenticacion/segundo-factor/cookie-segundo-factor";
import { cerrarSesion, crearSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerRutaPrincipal } from "@/modulos/identidad-acceso/autorizacion/rutas";

export type EstadoSegundoFactor = { error?: string };

export async function verificarSegundoFactor(_anterior: EstadoSegundoFactor, datos: FormData): Promise<EstadoSegundoFactor> {
    const token = await obtenerTokenSegundoFactor();
    if (!token) {
        await borrarCookieSegundoFactor();
        await cerrarSesion();
        redirect("/iniciar-sesion?segundoFactor=sin-datos");
    }
    const codigo = datos.get("codigo");
    const resultado = await confirmarSegundoFactor(token, typeof codigo === "string" ? codigo.trim() : "");
    if (!resultado || "bloqueado" in resultado) {
        await borrarCookieSegundoFactor();
        await cerrarSesion();
        redirect(`/iniciar-sesion?segundoFactor=${resultado ? "bloqueado" : "interrumpido"}`);
    }
    if ("error" in resultado) return { error: resultado.error };
    await crearSesion(resultado.usuarioId, "ADMINISTRADOR", resultado.versionSegundoFactor);
    await borrarCookieSegundoFactor();
    redirect(obtenerRutaPrincipal("ADMINISTRADOR"));
}

export async function cancelarVerificacion() {
    await cancelarSegundoFactor(await obtenerTokenSegundoFactor());
    await borrarCookieSegundoFactor();
    await cerrarSesion();
    redirect("/iniciar-sesion?segundoFactor=cancelado");
}
