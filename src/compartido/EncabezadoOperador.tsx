import HeaderPublico from "./HeaderPublico";
import { contarNotificacionesSinLeer } from "@/modulos/notificaciones/acciones";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerFotoPerfilOperadorPorUsuarioId } from "@/modulos/identidad-acceso/autenticacion/consultasAutenticacion";

export default async function EncabezadoOperador() {
    const sesion = await obtenerSesion();
    const fotoPerfil =
        sesion?.rol === "OPERADOR"
            ? await obtenerFotoPerfilOperadorPorUsuarioId(sesion.usuarioId)
            : null;

    const sinLeer = sesion && process.env.NODE_ENV !== "development" ? await contarNotificacionesSinLeer() : 0;
    return <HeaderPublico sesion={sesion} fotoPerfil={fotoPerfil} sinLeer={sinLeer} />;
}
