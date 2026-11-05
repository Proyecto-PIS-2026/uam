"use client";

import { useCallback, useState, type SetStateAction } from "react";

export function useSeleccionPublicacion(publicacionInicialId: number | null, publicaciones: readonly { id: number }[]) {
    const disponible = publicacionInicialId !== null && publicaciones.some(({ id }) => id === publicacionInicialId);
    const [seleccion, setSeleccion] = useState(() => ({
        enlace: publicacionInicialId,
        id: disponible ? publicacionInicialId : null,
    }));

    // Solo un enlace distinto inicia otra consulta; refrescar el listado conserva el cierre y los filtros.
    if (seleccion.enlace !== publicacionInicialId) {
        setSeleccion({ enlace: publicacionInicialId, id: disponible ? publicacionInicialId : null });
    }

    const setSeleccionId = useCallback((valor: SetStateAction<number | null>) => {
        setSeleccion((actual) => ({ ...actual, id: typeof valor === "function" ? valor(actual.id) : valor }));
    }, []);

    return {
        seleccionId: seleccion.id,
        setSeleccionId,
        avisoPublicacion: publicacionInicialId !== null && !disponible
            ? "La publicación del aviso ya no está disponible en tu mercado."
            : "",
    };
}
