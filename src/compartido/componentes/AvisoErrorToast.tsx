"use client";

import { useEffect, useRef } from "react";
import { useNotificacionToast } from "./NotificacionToast";

// Para errores recibidos como props o derivados de filtros, sin repetirlos al renderizar.
export default function AvisoErrorToast({ mensaje, tipo = "error" }: { mensaje?: string | null; tipo?: "error" | "warning" }) {
    const { notificar, cerrarNotificacion } = useNotificacionToast();
    const anterior = useRef<{ mensaje: string | null; tipo: "error" | "warning" }>({ mensaje: null, tipo });

    useEffect(() => {
        const actual = mensaje?.trim() || null;
        if (actual === anterior.current.mensaje && tipo === anterior.current.tipo) return;
        anterior.current = { mensaje: actual, tipo };
        cerrarNotificacion();
        if (actual) notificar(actual, tipo);
    }, [mensaje, tipo, notificar, cerrarNotificacion]);

    return null;
}
