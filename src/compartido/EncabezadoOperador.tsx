import HeaderPublico from "./HeaderPublico";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerFotoPerfilOperadorPorUsuarioId } from "@/modulos/identidad-acceso/autenticacion/consultasAutenticacion";

export default async function EncabezadoOperador() {
    const sesion = await obtenerSesion();
    const fotoPerfil =
        sesion?.rol === "OPERADOR"
            ? await obtenerFotoPerfilOperadorPorUsuarioId(sesion.usuarioId)
            : null;

    return <HeaderPublico sesion={sesion} fotoPerfil={fotoPerfil} />;
}
