"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const ejemplos = [
    { id: 4, titulo: "Recordatorio", descripcion: "Revisá que tus datos de contacto estén actualizados.", vista: false, fecha: "2026-10-30T15:00:00Z" },
    { id: 3, titulo: "Novedades del mercado", descripcion: "Hay nuevas publicaciones disponibles para consultar.", vista: false, fecha: "2026-10-30T13:00:00Z" },
    { id: 2, titulo: "Información de tu cuenta", descripcion: "Este mensaje permite probar la lectura y eliminación de una notificación.", vista: false, fecha: "2026-10-29T15:00:00Z" },
    { id: 1, titulo: "Bienvenido al mercado", descripcion: "Ya podés consultar las novedades de tu cuenta.", vista: false, fecha: "2026-10-27T15:00:00Z" },
];

const ContextoDemo = createContext<{
    activa: boolean;
    notificaciones: typeof ejemplos;
    modificar: (accion: "leer", id?: number) => Promise<void>;
} | null>(null);

export function ProveedorDemoNotificaciones({ children }: { children: ReactNode }) {
    const [notificaciones, setNotificaciones] = useState(ejemplos);
    const activa = process.env.NODE_ENV === "development";
    async function modificar(accion: "leer", id?: number) {
        if (accion !== "leer") throw new Error("Acción inválida.");
        setNotificaciones((actuales) => actuales.filter((n) => id !== undefined && n.id !== id));
    }
    return <ContextoDemo.Provider value={{ activa, notificaciones, modificar }}>{children}</ContextoDemo.Provider>;
}

export function useDemoNotificaciones() { return useContext(ContextoDemo); }

