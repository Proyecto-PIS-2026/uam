"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, IconButton, Snackbar, TextField } from "@mui/material";
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
    tipo?: "numero" | "url";
    onChangeValor?: (valor: string) => void;
    onGuardarValor?: (valor: string) => Promise<void>;
    onEliminarValor?: () => Promise<void>;
}

export default function TarjetaInput({ titulo, descripcion, valor = "", tipo = "numero", onChangeValor, onGuardarValor, onEliminarValor }: TarjetaInputProps) {
    const [editando, setEditando] = useState(false);
    const [eliminando, setEliminando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [valorAnterior, setValorAnterior] = useState(valor);
    const [mensajeError, setMensajeError] = useState("");
    const referenciaTarjeta = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function manejarClickFuera(evento: MouseEvent) {
            if ((editando || eliminando) && referenciaTarjeta.current && !referenciaTarjeta.current.contains(evento.target as Node)) {
                if (editando) {
                    onChangeValor?.(valorAnterior);
                }
                setEditando(false);
                setEliminando(false);
            }
        }
        document.addEventListener("mousedown", manejarClickFuera);
        return () => {document.removeEventListener("mousedown", manejarClickFuera)};
    }, [ editando, eliminando, valorAnterior, onChangeValor]);

    async function confirmar() {
        if (guardando) {
            return;
        }
        setGuardando(true);
        setMensajeError("");
        try {
            if (eliminando) {
                await onEliminarValor?.();
                setEliminando(false);
            } else {
                await onGuardarValor?.(valor);
                setValorAnterior(valor);
                setEditando(false);
            }
        } catch (error) {
            setMensajeError( error instanceof Error ? error.message : "Ocurrió un error al guardar la configuración.");
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

    const contenido = (
        <div className={styles.tarjeta}>
            <div className={styles.titulo}>
                {titulo}
            </div>
            <div className={styles.descripcion}>
                {descripcion}
            </div>
            <div ref={referenciaTarjeta} className={styles.contenedorEdicion}>
                <TextField fullWidth size="small" type={tipo === "url" ? "url" : "text"} value={valor} disabled={!editando || guardando} className={styles.selectMui}
                    slotProps={{
                        htmlInput: {
                            inputMode: tipo === "url" ? "url" : "numeric",
                            pattern: tipo === "url" ? undefined : "[0-9]*",
                        },
                    }}
                    onChange={(evento) => {
                        const nuevoValor = evento.target.value;
                        if (tipo === "url" || /^[0-9]*$/.test(nuevoValor)) {
                            onChangeValor?.(nuevoValor);
                        }
                    }}
                />
                {editando || eliminando ? (
                    <div className={styles.accionesEdicion}>
                        <IconButton aria-label={ eliminando ? "Confirmar eliminación" : "Guardar"} className={styles.botonGuardar} disabled={guardando} onClick={confirmar}>
                            <CheckOutlinedIcon />
                        </IconButton>
                        <IconButton aria-label="Cancelar" className={styles.botonDescartar} disabled={guardando} onClick={cancelar}>
                            <CloseOutlinedIcon />
                        </IconButton>
                    </div>
                ) : (
                    <div className={styles.accionesEdicion}>
                        <IconButton aria-label="Editar" className={styles.botonAccion} onClick={() => { setValorAnterior(valor); setEditando(true) }}>
                            <EditOutlinedIcon />
                        </IconButton>
                        <IconButton aria-label="Eliminar" className={styles.botonDescartar} onClick={() => { setValorAnterior(valor); setEliminando(true)}}>
                            <DeleteOutlinedIcon />
                        </IconButton>
                    </div>
                )}
            </div>
            <Snackbar open={Boolean(mensajeError)} autoHideDuration={4000} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}onClose={() => setMensajeError("")}>
                <Alert severity="error" variant="filled" onClose={() => setMensajeError("")}>{mensajeError}</Alert>
            </Snackbar>
        </div>
    );
    return contenido; 
}