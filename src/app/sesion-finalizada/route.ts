import { NextResponse } from "next/server";
import { cerrarSesion, obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { RUTA_INICIO_SESION } from "@/modulos/identidad-acceso/autenticacion/rutas-sesion";
import { obtenerRutaPrincipal } from "@/modulos/identidad-acceso/autorizacion/rutas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const sesion = await obtenerSesion();
        if (!sesion) await cerrarSesion();
        const destino = sesion ? obtenerRutaPrincipal(sesion.rol) : RUTA_INICIO_SESION;
        return new NextResponse(null, {
            status: 303,
            headers: { Location: destino, "Cache-Control": "no-store" },
        });
    } catch {
        return new Response("No pudimos verificar tu sesión. Intentá nuevamente.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
    }
}
