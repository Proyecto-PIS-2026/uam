"use client";

import { useTextoAjustable } from "@/compartido/hooks/useTextoAjustable";
import styles from "./TextoAjustable.module.css";

type TextoAjustableProps = {
    texto: string;
    className?: string;
    minimo: number;
    maximo: number;
};

export default function TextoAjustable({texto, className, minimo, maximo}: TextoAjustableProps) {
    const { contenedorRef, textoRef } = useTextoAjustable(texto, minimo, maximo);

    return (
        <div ref={contenedorRef} className={`${styles.contenedor} ${className ?? ""}`} title={texto}>
            <span ref={textoRef} className={styles.texto} style={{ fontSize: `${maximo}px` }}>{texto}</span>
        </div>
    );
}