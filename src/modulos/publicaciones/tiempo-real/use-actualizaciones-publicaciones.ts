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
        let versionAplicada: string | null = null;
        let enCurso: { version: string | null } | null = null;
        let pendiente: { version: string | null } | null = null;
        let cerrado = false;
        const recargar = async () => {
            if (cerrado || enCurso || !pendiente || document.visibilityState === "hidden") return;
            const solicitud = pendiente;
            pendiente = null;
            enCurso = solicitud;
            try {
                const resultado = await actualizar();
                if (!cerrado && resultado !== false) versionAplicada = solicitud.version;
            } catch {
            } finally {
                enCurso = null;
                programar();
            }
        };
        const programar = () => {
            if (temporizador !== undefined || cerrado || enCurso || !pendiente || document.visibilityState === "hidden") return;
            temporizador = setTimeout(() => {
                temporizador = undefined;
                void recargar();
            }, 200);
        };
        const conectar = () => {
            fuente?.close();
            fuente = null;
            clearTimeout(temporizador);
            temporizador = undefined;
            pendiente = null;
            if (document.visibilityState === "hidden") return;
            const parametros = operadorId !== undefined ? `?operadorId=${operadorId}`
                : operadorPublicoId !== undefined ? `?operadorPublicoId=${operadorPublicoId}` : "";
            const nuevaFuente = new EventSource(`/api/publicaciones/eventos${parametros}`);
            fuente = nuevaFuente;
            const recibir = (evento: Event) => {
                if (cerrado || fuente !== nuevaFuente || document.visibilityState === "hidden") return;
                const identificador = (evento as MessageEvent).lastEventId;
                const version = typeof identificador === "string" && identificador !== "" ? identificador : null;
                if (version !== null && (version === versionAplicada || version === enCurso?.version)) return;
                pendiente = { version };
                programar();
            };
            nuevaFuente.addEventListener("cambio", recibir);
            nuevaFuente.addEventListener("conectado", recibir);
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
