"use client";

import { useState } from "react";

export function useBorradorConfiguracion(configuracion: Record<string, string>) {
    const [estado, setEstado] = useState({ valores: configuracion, guardado: configuracion, recibido: configuracion });
    const claves = Object.keys(configuracion);

    if (claves.some((clave) => estado.recibido[clave] !== configuracion[clave])) {
        setEstado((actual) => {
            const valores = { ...actual.valores };
            const guardado = { ...actual.guardado };
            for (const clave of claves) {
                if (actual.recibido[clave] === configuracion[clave]) continue;
                if (actual.valores[clave] === actual.guardado[clave]) valores[clave] = configuracion[clave];
                guardado[clave] = configuracion[clave];
            }
            return { valores, guardado, recibido: configuracion };
        });
    }

    function cambiar(cambios: Record<string, string>) {
        setEstado((actual) => ({ ...actual, valores: { ...actual.valores, ...cambios } }));
    }

    function cancelar() {
        setEstado((actual) => ({ ...actual, valores: actual.guardado }));
    }

    function confirmar(cambios: Record<string, string>) {
        setEstado((actual) => ({
            ...actual,
            valores: { ...actual.valores, ...cambios },
            guardado: { ...actual.guardado, ...cambios },
        }));
    }

    const cambios = Object.fromEntries(Object.entries(estado.valores).filter(([clave, valor]) => valor !== estado.guardado[clave]));
    return { valores: estado.valores, guardado: estado.guardado, cambios, cambiar, cancelar, confirmar };
}
