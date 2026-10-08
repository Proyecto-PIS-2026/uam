"use client";

import { useEffect, useRef, useState } from "react";
import { IconButton, TextField } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";

import styles from "./tarjetaInput.module.css";

interface TarjetaInputProps { 
    titulo: string; 
    descripcion: string;
    label?: string;
    valor?: string;
    onChangeValor?: (valor: string) => void;
    onGuardarValor?: (valor: string) => Promise<void>;
    onEliminarValor?: () => Promise<void>;
}

export default function TarjetaInput({
    titulo,
    descripcion,
    label,
    valor = "",
    onChangeValor,
    onGuardarValor,
    onEliminarValor,
}: TarjetaInputProps) {
    const [editando, setEditando] = useState(false);
    const [eliminando, setEliminando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [valorAnterior, setValorAnterior] = useState(valor);

    const referenciaTarjeta = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function manejarClickFuera(evento: MouseEvent) {
            if (
                (editando || eliminando) &&
                referenciaTarjeta.current &&
                !referenciaTarjeta.current.contains(evento.target as Node)
            ) {
                if (editando) {
                    onChangeValor?.(valorAnterior);
                }

                setEditando(false);
                setEliminando(false);
            }
        }

        document.addEventListener("mousedown", manejarClickFuera);

        return () => {
            document.removeEventListener("mousedown", manejarClickFuera);
        };
    }, [
        editando,
        eliminando,
        valorAnterior,
        onChangeValor,
    ]);

    async function confirmar() {
        if (guardando) return;

        setGuardando(true);

        try {
            if (eliminando) {
                await onEliminarValor?.();
                setEliminando(false);
            } else {
                await onGuardarValor?.(valor);
                setValorAnterior(valor);
                setEditando(false);
            }
        } finally {
            setGuardando(false);
        }
    }

    function cancelar() {
        if (eliminando) {
            setEliminando(false);
            return;
        }

        onChangeValor?.(valorAnterior);
        setEditando(false);
    }

    return (
        <div className={styles.tarjeta}>
            <div className={styles.titulo}>
                {titulo}
            </div>

            <div className={styles.descripcion}>
                {descripcion}
            </div>

            <div
                ref={referenciaTarjeta}
                className={styles.contenedorEdicion}
            >
                <TextField
                    fullWidth
                    size="small"
                    type="text"
                    value={valor}
                    disabled={!editando || guardando}
                    className={styles.selectMui}
                    slotProps={{
                        htmlInput: {
                            inputMode: "numeric",
                            pattern: "[0-9]*",
                        },
                    }}
                    onChange={(evento) => {
                        const nuevoValor = evento.target.value;

                        if (/^[0-9]*$/.test(nuevoValor)) {
                            onChangeValor?.(nuevoValor);
                        }
                    }}
                />

                {editando || eliminando ? (
                    <div className={styles.accionesEdicion}>
                        <IconButton
                            aria-label={
                                eliminando
                                    ? "Confirmar eliminación"
                                    : "Guardar"
                            }
                            className={styles.botonGuardar}
                            disabled={guardando}
                            onClick={confirmar}
                        >
                            <CheckOutlinedIcon />
                        </IconButton>

                        <IconButton
                            aria-label="Cancelar"
                            className={styles.botonDescartar}
                            disabled={guardando}
                            onClick={cancelar}
                        >
                            <CloseOutlinedIcon />
                        </IconButton>
                    </div>
                ) : (
                    <div className={styles.accionesEdicion}>
                        <IconButton
                            aria-label="Editar"
                            className={styles.botonAccion}
                            onClick={() => {
                                setValorAnterior(valor);
                                setEditando(true);
                            }}
                        >
                            <EditOutlinedIcon />
                        </IconButton>

                        <IconButton
                            aria-label="Eliminar"
                            className={styles.botonDescartar}
                            onClick={() => {
                                setValorAnterior(valor);
                                setEliminando(true);
                            }}
                        >
                            <DeleteOutlinedIcon />
                        </IconButton>
                    </div>
                )}
            </div>
        </div>
    );
}