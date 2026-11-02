"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CANAL_NOTIFICACIONES, esCambioNotificaciones, EVENTO_NOTIFICACIONES } from "./cliente";

export function useContadorNotificaciones(usuarioId: number | null) {
    const [estado, setEstado] = useState({ usuarioId, noLeidas: 0 });
    const refrescarRef = useRef<() => void>(() => {});
    const refrescar = useCallback(() => refrescarRef.current(), []);

    useEffect(() => {
        if (usuarioId === null) return;
        let activo = true;
        let pedido = 0;
        let controlador: AbortController | null = null;

        async function cargar() {
            if (document.visibilityState === "hidden") return;
            const actual = ++pedido;
            controlador?.abort();
            const abortador = new AbortController();
            controlador = abortador;
            try {
                const respuesta = await fetch("/api/notificaciones/resumen", { cache: "no-store", signal: abortador.signal });
                const datos = respuesta.status === 401 ? { noLeidas: 0 } : respuesta.ok ? await respuesta.json() : null;
                if (activo && actual === pedido && datos && Number.isSafeInteger(datos.noLeidas) && datos.noLeidas >= 0) {
                    setEstado({ usuarioId, noLeidas: datos.noLeidas });
                }
            } catch {
                return;
            } finally {
                if (controlador === abortador) controlador = null;
            }
        }

        function recibirCambio(cambio: unknown) {
            if (!activo || !esCambioNotificaciones(cambio) || cambio.usuarioId !== usuarioId) return;
            ++pedido;
            controlador?.abort();
            controlador = null;
            setEstado({ usuarioId, noLeidas: cambio.noLeidas });
        }

        const alCambiar = (evento: Event) => recibirCambio((evento as CustomEvent).detail);
        const alRecibir = (evento: MessageEvent) => recibirCambio(evento.data);
        const actualizar = () => { void cargar(); };
        let canal: BroadcastChannel | null = null;
        try {
            if (typeof BroadcastChannel !== "undefined") canal = new BroadcastChannel(CANAL_NOTIFICACIONES);
        } catch {
            canal = null;
        }
        canal?.addEventListener("message", alRecibir);
        window.addEventListener(EVENTO_NOTIFICACIONES, alCambiar);
        window.addEventListener("focus", actualizar);
        document.addEventListener("visibilitychange", actualizar);
        const intervalo = window.setInterval(actualizar, 60_000);
        refrescarRef.current = actualizar;
        actualizar();

        return () => {
            activo = false;
            controlador?.abort();
            window.clearInterval(intervalo);
            window.removeEventListener(EVENTO_NOTIFICACIONES, alCambiar);
            window.removeEventListener("focus", actualizar);
            document.removeEventListener("visibilitychange", actualizar);
            canal?.close();
            refrescarRef.current = () => {};
        };
    }, [usuarioId]);

    return { noLeidas: usuarioId !== null && estado.usuarioId === usuarioId ? estado.noLeidas : 0, refrescar };
}
