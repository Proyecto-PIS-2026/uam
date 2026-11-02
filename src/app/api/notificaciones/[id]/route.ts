import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { eliminarNotificacion, ErrorNotificaciones, marcarNotificacionLeida, validarIdNotificacion } from "@/modulos/notificaciones/notificaciones";
import { respuestaErrorNotificaciones, respuestaNotificaciones } from "@/modulos/notificaciones/respuestas-http";

export const runtime = "nodejs";

type Contexto = { params: Promise<{ id: string }> };

async function modificar(contexto: Contexto, eliminar: boolean) {
    try {
        const sesion = await obtenerSesion();
        if (!sesion) throw new ErrorNotificaciones(401, "Iniciá sesión para consultar tus notificaciones.");
        const id = validarIdNotificacion((await contexto.params).id);
        const noLeidas = eliminar ? await eliminarNotificacion(sesion, id) : await marcarNotificacionLeida(sesion, id);
        return respuestaNotificaciones({ noLeidas });
    } catch (error) {
        return respuestaErrorNotificaciones(error);
    }
}

export async function PATCH(_solicitud: Request, contexto: Contexto) {
    return modificar(contexto, false);
}

export async function DELETE(_solicitud: Request, contexto: Contexto) {
    return modificar(contexto, true);
}
