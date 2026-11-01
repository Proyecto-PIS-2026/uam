import { NextResponse } from "next/server";
import { cerrarSesion, obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { RUTA_INICIO_SESION } from "@/modulos/identidad-acceso/autenticacion/rutas-sesion";
import { obtenerRutaPrincipal } from "@/modulos/identidad-acceso/autorizacion/rutas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(solicitud: Request) {
    try {
        const sesion = await obtenerSesion();
        if (!sesion) await cerrarSesion();
        const destino = sesion ? obtenerRutaPrincipal(sesion.rol) : RUTA_INICIO_SESION;
        const respuesta = NextResponse.redirect(new URL(destino, solicitud.url), 303);
        respuesta.headers.set("Cache-Control", "no-store");
        return respuesta;
    } catch {
        return new Response("No pudimos verificar tu sesión. Intentá nuevamente.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
    }
}
