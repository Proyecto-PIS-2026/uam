export const EVENTO_NOTIFICACIONES = "uam:notificaciones";
export const CANAL_NOTIFICACIONES = "uam-notificaciones";

export type CambioNotificaciones = { usuarioId: number; noLeidas: number };

export function esCambioNotificaciones(valor: unknown): valor is CambioNotificaciones {
    if (!valor || typeof valor !== "object") return false;
    const datos = valor as CambioNotificaciones;
    return Number.isSafeInteger(datos.usuarioId) && datos.usuarioId > 0 && Number.isSafeInteger(datos.noLeidas) && datos.noLeidas >= 0;
}

export function notificarCambioNotificaciones(usuarioId: number, noLeidas: number) {
    const cambio = { usuarioId, noLeidas };
    if (typeof window === "undefined" || !esCambioNotificaciones(cambio)) return;
    window.dispatchEvent(new CustomEvent(EVENTO_NOTIFICACIONES, { detail: cambio }));
    if (typeof BroadcastChannel !== "undefined") {
        try {
            const canal = new BroadcastChannel(CANAL_NOTIFICACIONES);
            try { canal.postMessage(cambio); } finally { canal.close(); }
        } catch {
            return;
        }
    }
}
