"use client";

import { useState } from "react";
import styles from "./tarjetaConfiguracion.module.css";

type TipoCampo = "checkbox" | "number" | "url";

interface TarjetaConfiguracionProps {
    titulo: string;
    descripcion: string;
    valorInicial: string | null;
    tipo: TipoCampo;
    label: string;
}

export default function TarjetaConfiguracion({ titulo, descripcion, valorInicial, tipo, label }: TarjetaConfiguracionProps) {
    const [valor, setValor] = useState(valorInicial ?? "");
    const contenido = (
        <div className={styles.tarjeta}>
            <div className={styles.titulo}>{titulo}</div>
            <div className={styles.descripcion}>{descripcion}</div>
            {tipo === "checkbox" ? (
    <label className={styles.checkbox}>
        <input
            type="checkbox"
            checked={valor === "true"}
            onChange={(e) =>
                setValor(String(e.target.checked))
            }
        />

        {label}
    </label>
) : (
    <label className={styles.campo}>
        {label}

        <input
            className={styles.input}
            type={tipo}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
        />
    </label>
)}
        </div>
    );
    return contenido; 
}