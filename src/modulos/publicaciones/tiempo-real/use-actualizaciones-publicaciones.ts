"use client";

import { useEffect, useEffectEvent } from "react";

export function useActualizacionesPublicaciones(alActualizar: () => void | Promise<unknown>, filtro?: number | { operadorPublicoId: number }) {
    const operadorId = typeof filtro === "number" ? filtro : undefined;
    const operadorPublicoId = typeof filtro === "object" ? filtro.operadorPublicoId : undefined;
    const actualizar = useEffectEvent(alActualizar);
    useEffect(() => {
        if (typeof EventSource === "undefined") return;
        let fuente: EventSource | null = null;
        let temporizador: ReturnType<typeof setTimeout> | undefined;
        let actualizando = false;
        let pendiente = false;
        let cerrado = false;
        const recargar = async () => {
            if (cerrado) return;
            if (actualizando) { pendiente = true; return; }
            actualizando = true;
            try { await actualizar(); } catch {} finally {
                actualizando = false;
                if (pendiente && !cerrado) {
                    pendiente = false;
                    programar();
                }
            }
        };
        const programar = () => {
            if (temporizador || cerrado) return;
            temporizador = setTimeout(() => {
                temporizador = undefined;
                void recargar();
            }, 200);
        };
        const conectar = () => {
            fuente?.close();
            fuente = null;
            if (document.visibilityState === "hidden") return;
            const parametros = operadorId !== undefined ? `?operadorId=${operadorId}`
                : operadorPublicoId !== undefined ? `?operadorPublicoId=${operadorPublicoId}` : "";
            fuente = new EventSource(`/api/publicaciones/eventos${parametros}`);
            fuente.addEventListener("cambio", programar);
            fuente.addEventListener("conectado", programar);
        };
        conectar();
        document.addEventListener("visibilitychange", conectar);
        return () => {
            cerrado = true;
            fuente?.close();
            clearTimeout(temporizador);
            document.removeEventListener("visibilitychange", conectar);
        };
    }, [operadorId, operadorPublicoId]);
}
