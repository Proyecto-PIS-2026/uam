import HeaderPublico from "./HeaderPublico";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerIdentidadOperadorPorUsuarioId, obtenerIdentidadProductorPorUsuarioId } from "@/modulos/identidad-acceso/autenticacion/consultasAutenticacion";

export default async function EncabezadoOperador() {
    const sesion = await obtenerSesion();
    const perfil =
        sesion?.rol === "OPERADOR"
            ? await obtenerIdentidadOperadorPorUsuarioId(sesion.usuarioId)
            : sesion?.rol === "PRODUCTOR"
                ? await obtenerIdentidadProductorPorUsuarioId(sesion.usuarioId)
                : null;

    return <HeaderPublico sesion={sesion} fotoPerfil={perfil?.fotoPerfil ?? null} nombrePerfil={perfil?.nombreFantasia ?? null} />;
}
