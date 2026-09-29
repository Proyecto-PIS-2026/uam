"use client";

import { useState, type ReactNode } from "react";
import Image, { type ImageProps } from "next/image";

type Props = Omit<ImageProps, "src" | "alt" | "onError"> & {
    src: string | null | undefined;
    alt: string;
    reemplazo: ReactNode;
};

export default function ImagenPublicacion({ src, alt, reemplazo, ...props }: Props) {
    const [fuenteFallida, setFuenteFallida] = useState<string | null>(null);
    const fuente = src?.trim();

    if (!fuente || fuente === fuenteFallida) return <>{reemplazo}</>;

    return <Image {...props} src={fuente} alt={alt} onError={() => setFuenteFallida(fuente)} />;
}
