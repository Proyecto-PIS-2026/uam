"use client";

import type { ReactNode } from "react";
import { useTextoAjustable } from "@/compartido/hooks/useTextoAjustable";

type TextoAjustableProps = {
    children: ReactNode;
    className?: string;
    minimo: number;
    maximo: number;
};

export default function TextoAjustable({ children, className, minimo, maximo }: TextoAjustableProps) {
    const { contenedorRef, textoRef } = useTextoAjustable(children, minimo, maximo);
    return (
        <div ref={contenedorRef} className={className} style={{ width: "100%", minWidth: 0, whiteSpace: "nowrap" }}>
            <span ref={textoRef} style={{ display: "inline-block", whiteSpace: "nowrap" }}>{children}</span>
        </div>
    );
}