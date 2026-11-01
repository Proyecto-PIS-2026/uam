"use client";

import { useState, type ReactNode } from "react";
import Image, { type ImageProps } from "next/image";

type Props = Omit<ImageProps, "src"> & {
    src: string | null | undefined;
    reemplazo: ReactNode;
};

export default function ImagenPerfil({ src, alt, reemplazo, onError, unoptimized, ...props }: Props) {
    const [fuenteFallida, setFuenteFallida] = useState<string | null>(null);
    const fuente = src?.trim();

    if (!fuente || fuente === fuenteFallida) return <>{reemplazo}</>;

    return <Image
        {...props}
        key={fuente}
        src={fuente}
        alt={alt}
        unoptimized={fuente.startsWith("/api/") || unoptimized}
        onError={(evento) => {
            setFuenteFallida(fuente);
            onError?.(evento);
        }}
    />;
}
