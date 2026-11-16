"use client";

import { useId } from "react";
import { TextField } from "@mui/material";
import styles from "./TarjetaInput.module.css";

interface TarjetaInputProps {
    titulo: string;
    descripcion: string;
    label?: string;
    valor: string;
    tipo?: "numero" | "url";
    onChangeValor: (valor: string) => void;
    guardando?: boolean;
    modificado?: boolean;
    error?: boolean;
}

export default function TarjetaInput({ titulo, descripcion, label, valor, tipo = "numero", onChangeValor, guardando = false, modificado = false, error = false }: TarjetaInputProps) {
    const id = useId();

    return (
        <div className={styles.tarjeta}>
            <div id={`${id}-titulo`} className={styles.titulo}>{titulo}</div>
            <div id={`${id}-descripcion`} className={styles.descripcion}>{descripcion}</div>
            <div className={styles.contenedorEdicion} data-modificado={modificado}>
                <TextField required fullWidth size="small" label={label} type={tipo === "url" ? "url" : "text"}
                    value={valor} disabled={guardando} error={error} className={styles.selectMui}
                    slotProps={{ htmlInput: { "aria-labelledby": label ? undefined : `${id}-titulo`, "aria-describedby": `${id}-descripcion`, inputMode: tipo === "url" ? "url" : "numeric", pattern: tipo === "url" ? undefined : "[0-9]*" } }}
                    onChange={(evento) => {
                        const nuevoValor = evento.target.value;
                        if (tipo === "url" || /^[0-9]*$/.test(nuevoValor)) onChangeValor(nuevoValor);
                    }}
                />
            </div>
        </div>
    );
}
