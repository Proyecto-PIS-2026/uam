"use client";

import { useMemo, useSyncExternalStore } from "react";

function crearVistaPrevia(archivo: File | null) {
    let url: string | null = null;
    const suscriptores = new Set<() => void>();

    return {
        obtenerUrl: () => url,
        suscribir(notificar: () => void) {
            suscriptores.add(notificar);
            if (archivo && url === null) {
                url = URL.createObjectURL(archivo);
                for (const actualizar of suscriptores) actualizar();
            }
            return () => {
                suscriptores.delete(notificar);
                if (suscriptores.size === 0 && url !== null) {
                    URL.revokeObjectURL(url);
                    url = null;
                }
            };
        },
    };
}

function obtenerVistaPreviaServidor() {
    return null;
}

export function useVistaPreviaArchivo(archivo: File | null): string | null {
    const vistaPrevia = useMemo(() => crearVistaPrevia(archivo), [archivo]);
    return useSyncExternalStore(vistaPrevia.suscribir, vistaPrevia.obtenerUrl, obtenerVistaPreviaServidor);
}
