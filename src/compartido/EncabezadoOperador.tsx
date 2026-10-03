import HeaderPublico from "./HeaderPublico";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerOperadorAutenticadoPorUsuarioId } from "@/modulos/identidad-acceso/autenticacion/consultasAutenticacion";

export default async function EncabezadoOperador() {
    const sesion = await obtenerSesion();
    const operador = sesion?.rol === "OPERADOR"
        ? await obtenerOperadorAutenticadoPorUsuarioId(sesion.usuarioId)
        : null;

    return <HeaderPublico operador={operador} />;
}