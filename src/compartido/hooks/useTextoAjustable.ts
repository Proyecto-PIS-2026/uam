"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function useTextoAjustable(texto: ReactNode, minimo: number, maximo: number) {
    const contenedorRef = useRef<HTMLDivElement>(null);
    const textoRef = useRef<HTMLSpanElement>(null);

    useLayoutEffect(() => {
        const contenedor = contenedorRef.current;
        const contenido = textoRef.current;
        if (!contenedor || !contenido) return;
        let activo = true;
        let ultimoAncho = -1;

        const ajustar = () => {
            if (!activo) return;
            const anchoDisponible = contenedor.clientWidth - 2;
            if (anchoDisponible <= 0) return;
            let tamaño = maximo;
            contenido.style.fontSize = `${tamaño}px`;

            while (contenido.getBoundingClientRect().width > anchoDisponible && tamaño > minimo) {
                tamaño = Math.max(minimo, tamaño - 0.5);
                contenido.style.fontSize = `${tamaño}px`;
            }
        };

        ajustar();
        const observer = new ResizeObserver(([entrada]) => {
            const ancho = entrada.contentRect.width;
            if (ancho !== ultimoAncho) {
                ultimoAncho = ancho;
                ajustar();
            }
        });
        observer.observe(contenedor);
        void document.fonts.ready.then(ajustar);
        document.fonts.addEventListener("loadingdone", ajustar);

        return () => {
            activo = false;
            observer.disconnect();
            document.fonts.removeEventListener("loadingdone", ajustar);
        };
    }, [texto, minimo, maximo]);

    return { contenedorRef, textoRef };
}