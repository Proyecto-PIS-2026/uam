"use server";

import { redirect } from "next/navigation";
import { cancelarSegundoFactor, confirmarSegundoFactor } from "@/modulos/identidad-acceso/autenticacion/segundo-factor";
import { borrarCookieSegundoFactor, obtenerTokenSegundoFactor } from "@/modulos/identidad-acceso/autenticacion/cookie-segundo-factor";
import { cerrarSesion, crearSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerRutaPrincipal } from "@/modulos/identidad-acceso/autorizacion/rutas";

export type EstadoSegundoFactor = { error?: string };

export async function verificarSegundoFactor(_anterior: EstadoSegundoFactor, datos: FormData): Promise<EstadoSegundoFactor> {
    const codigo = datos.get("codigo");
    const resultado = await confirmarSegundoFactor(await obtenerTokenSegundoFactor(), typeof codigo === "string" ? codigo.trim() : "");
    if (!resultado || "bloqueado" in resultado) {
        await borrarCookieSegundoFactor();
        await cerrarSesion();
        redirect(`/iniciar-sesion?segundoFactor=${resultado ? "bloqueado" : "vencido"}`);
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
