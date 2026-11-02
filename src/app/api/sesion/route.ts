import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
    const headers = { "Cache-Control": "no-store", "Vary": "Cookie" };
    try {
        if (!await obtenerSesion()) {
            return Response.json({ errores: ["Tu sesión finalizó. Volvé a iniciar sesión."] }, { status: 401, headers });
        }
        return new Response(null, { status: 204, headers });
    } catch (error) {
        console.error("No se pudo verificar la sesión:", error);
        return Response.json({ errores: ["No se pudo verificar tu sesión. Intentá nuevamente."] }, { status: 503, headers });
    }
}
