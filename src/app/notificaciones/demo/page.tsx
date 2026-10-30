import { notFound, redirect } from "next/navigation";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import DemoNotificaciones from "@/modulos/notificaciones/DemoNotificaciones";

export default async function DemoNotificacionesPage() {
    if (process.env.NODE_ENV !== "development") notFound();
    if (!await obtenerSesion()) redirect("/iniciar-sesion");
    return <DemoNotificaciones />;
}
