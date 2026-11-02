import { redirect } from "next/navigation";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import VistaNotificaciones from "@/modulos/notificaciones/componentes/VistaNotificaciones";

export const dynamic = "force-dynamic";

export default async function PaginaNotificaciones() {
    const sesion = await obtenerSesion();
    if (!sesion) redirect("/iniciar-sesion");
    return <VistaNotificaciones key={sesion.usuarioId} usuarioId={sesion.usuarioId} />;
}
