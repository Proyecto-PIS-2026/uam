
"use client";

import { useState } from "react";
import { Switch } from "@mui/material";

import styles from "./tarjetaCheckBox.module.css";

interface TarjetaCheckBoxProps {
    titulo: string;
    descripcion: string;
    checked?: boolean;
    onChangeChecked?: (valor: boolean) => Promise<void>;
}

export default function TarjetaCheckBox({
    titulo,
    descripcion,
    checked = false,
    onChangeChecked,
}: TarjetaCheckBoxProps) {
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");

    async function cambiarEstado(nuevoEstado: boolean) {
        if (guardando) return;

        setGuardando(true);
        setError("");

        try {
            await onChangeChecked?.(nuevoEstado);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo modificar la configuración."
            );
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className={styles.tarjeta}>
            <div className={styles.titulo}>{titulo}</div>

            <div className={styles.descripcion}>
                {descripcion}
            </div>

            <div
                className={`${styles.contenedorSwitch} ${
                    checked
                        ? styles.contenedorSwitchActivo
                        : styles.contenedorSwitchInactivo
                }`}
            >
                <Switch
                    checked={checked}
                    disabled={guardando}
                    onChange={(evento) => {
                        void cambiarEstado(evento.target.checked);
                    }}
                    slotProps={{
                        input: {
                            "aria-label": titulo,
                        },
                    }}
                />
            </div>

            {error && (
                <p className={styles.mensajeError} role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
