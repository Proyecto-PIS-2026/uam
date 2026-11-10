
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { obtenerFechaEstadistica, registrarVisita } from "@/modulos/administracion/estadisticas/registrar-estadisticas";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";

export const runtime = "nodejs";

export async function GET() {
    if (process.env.DISABLE_VISIT_TRACKING === "true") {
        return NextResponse.json({ ok: true, omitido: true });
    }

    try {
        const sesion = await obtenerSesion();

        if (sesion) return NextResponse.json({ ok: true, omitido: true });

        const fechaStr = obtenerFechaEstadistica();
        const nombreCookie = `uam_visita_${fechaStr}`;

        const cookieStore = await cookies();
        const visitaRegistrada = cookieStore.get(nombreCookie);

        if (visitaRegistrada) return NextResponse.json({ ok: true, registrado: false });

        await registrarVisita("comprador", fechaStr);

        const response = NextResponse.json({ ok: true, registrado: true });

        response.cookies.set(nombreCookie, "1", {
            path: "/",
            maxAge: 60 * 60 * 24,
            httpOnly: true,
            sameSite: "lax",
        });

        return response;
    } catch (error) {
        console.error("Error al registrar visita de comprador:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
