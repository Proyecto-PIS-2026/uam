import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { contarNotificacionesNoLeidas } from "@/modulos/notificaciones/notificaciones";
import { respuestaErrorNotificaciones, respuestaNotificaciones } from "@/modulos/notificaciones/respuestas-http";

export const runtime = "nodejs";

export async function GET() {
    try {
        return respuestaNotificaciones({ noLeidas: await contarNotificacionesNoLeidas(await obtenerSesion()) });
    } catch (error) {
        return respuestaErrorNotificaciones(error);
    }
}
