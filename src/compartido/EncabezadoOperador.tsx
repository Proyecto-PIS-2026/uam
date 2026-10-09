import HeaderPublico from "./HeaderPublico";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";

export default async function EncabezadoOperador() {
    const sesion = await obtenerSesion();

    return <HeaderPublico sesion={sesion} />;
}
