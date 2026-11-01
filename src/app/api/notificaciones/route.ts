import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { consultarNotificaciones, eliminarTodasNotificaciones, marcarTodasNotificacionesLeidas } from "@/modulos/notificaciones/notificaciones";
import { respuestaErrorNotificaciones, respuestaNotificaciones } from "@/modulos/notificaciones/respuestas-http";

export const runtime = "nodejs";

export async function GET() {
    try {
        return respuestaNotificaciones(await consultarNotificaciones(await obtenerSesion()));
    } catch (error) {
        return respuestaErrorNotificaciones(error);
    }
}

export async function PATCH() {
    try {
        return respuestaNotificaciones({ noLeidas: await marcarTodasNotificacionesLeidas(await obtenerSesion()) });
    } catch (error) {
        return respuestaErrorNotificaciones(error);
    }
}

export async function DELETE() {
    try {
        return respuestaNotificaciones({ noLeidas: await eliminarTodasNotificaciones(await obtenerSesion()) });
    } catch (error) {
        return respuestaErrorNotificaciones(error);
    }
}
