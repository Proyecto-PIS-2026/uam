import EncabezadoAplicacion from "./EncabezadoAplicacion";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerIdentidadOperadorPorUsuarioId, obtenerIdentidadProductorPorUsuarioId } from "@/modulos/identidad-acceso/autenticacion/consultas-autenticacion";

export default async function EncabezadoConSesion() {
    const sesion = await obtenerSesion();
    const perfil =
        sesion?.rol === "OPERADOR"
            ? await obtenerIdentidadOperadorPorUsuarioId(sesion.usuarioId)
            : sesion?.rol === "PRODUCTOR"
                ? await obtenerIdentidadProductorPorUsuarioId(sesion.usuarioId)
                : null;

    return <EncabezadoAplicacion sesion={sesion} fotoPerfil={perfil?.fotoPerfil ?? null} nombrePerfil={perfil?.nombreFantasia ?? null} />;
}
