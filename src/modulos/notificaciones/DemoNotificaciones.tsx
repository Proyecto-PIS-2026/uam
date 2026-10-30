"use client";
import ListaNotificaciones from "./ListaNotificaciones";
import { useDemoNotificaciones } from "./ContextoDemo";
export default function DemoNotificaciones() {
    const demo = useDemoNotificaciones();
    if (!demo?.activa) return null;
    return <ListaNotificaciones notificaciones={demo.notificaciones} onModificar={demo.modificar} />;
}
