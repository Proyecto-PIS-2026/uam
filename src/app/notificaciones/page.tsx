import { redirect } from "next/navigation";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { listarNotificaciones } from "@/modulos/notificaciones/acciones";
import ListaNotificaciones from "@/modulos/notificaciones/ListaNotificaciones";
import DemoNotificaciones from "@/modulos/notificaciones/DemoNotificaciones";

export default async function NotificacionesPage() {
    if (!await obtenerSesion()) redirect("/iniciar-sesion");
    if (process.env.NODE_ENV === "development") return <DemoNotificaciones />;
    return <ListaNotificaciones notificaciones={await listarNotificaciones()} />;
}
