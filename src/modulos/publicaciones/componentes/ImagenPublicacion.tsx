"use client";

import { useState, type ReactNode } from "react";
import Image, { type ImageProps } from "next/image";

type Props = Omit<ImageProps, "src" | "alt"> & {
    src: string | null | undefined;
    alt: string;
    reemplazo: ReactNode;
};

export default function ImagenPublicacion({ src, alt, reemplazo, onLoad, onError, style, ...props }: Props) {
    const [fuenteFallida, setFuenteFallida] = useState<string | null>(null);
    const [fuenteCargada, setFuenteCargada] = useState<string | null>(null);
    const fuente = src?.trim();
    if (!fuente || fuente === fuenteFallida) {
        return <>{reemplazo}</>;
    }
    const cargada = fuenteCargada === fuente;
    const contenido = (
        <>
            {!cargada && reemplazo}
            <Image {...props} key={fuente} src={fuente} alt={alt} unoptimized={fuente.startsWith("/api/") || props.unoptimized} style={{ ...style, visibility: cargada ? "visible" : "hidden" }}
                onLoad={(evento) => {
                    setFuenteCargada(fuente);
                    onLoad?.(evento);
                }}
                onError={(evento) => {
                    setFuenteFallida(fuente);
                    onError?.(evento);
                }}
            />
        </>
    );
    return contenido;
}
