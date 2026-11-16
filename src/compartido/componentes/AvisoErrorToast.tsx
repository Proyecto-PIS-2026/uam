"use client";

import { useEffect, useRef } from "react";
import { useNotificacionToast } from "./NotificacionToast";

// Para errores recibidos como props o derivados de filtros, sin repetirlos al renderizar.
export default function AvisoErrorToast({ mensaje, tipo = "error", cerrarAlCorregir = true }: { mensaje?: string | null; tipo?: "error" | "warning"; cerrarAlCorregir?: boolean }) {
    const { notificar, cerrarNotificacion } = useNotificacionToast();
    const anterior = useRef<{ mensaje: string | null; tipo: "error" | "warning" }>({ mensaje: null, tipo });

    useEffect(() => {
        const actual = mensaje?.trim() || null;
        const cambio = actual !== anterior.current.mensaje || tipo !== anterior.current.tipo;
        anterior.current = { mensaje: actual, tipo };
        if (actual && cambio) notificar(actual, tipo);
        else if (!actual && cerrarAlCorregir) cerrarNotificacion();
    }, [mensaje, tipo, cerrarAlCorregir, notificar, cerrarNotificacion]);

    return null;
}
