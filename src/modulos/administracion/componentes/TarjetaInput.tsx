"use client";

import { useState } from "react";
import { Alert, Fade, IconButton, Snackbar, TextField } from "@mui/material";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";

import styles from "./TarjetaInput.module.css";

interface TarjetaInputProps { 
    titulo: string; 
    descripcion: string;
    label?: string;
    valor?: string;
    tipo?: "numero" | "url";
    onChangeValor?: (valor: string) => void;
    onGuardarValor?: (valor: string) => Promise<void>;
}

export default function TarjetaInput({ titulo, descripcion, valor = "", tipo = "numero", onChangeValor, onGuardarValor }: TarjetaInputProps) {
    const [guardando, setGuardando] = useState(false);
    const [valorInicialGuardado, setValorInicialGuardado] = useState(valor);
    const [mensajeAlerta, setMensajeAlerta] = useState("");
    const [tipoAlerta, setTipoAlerta] = useState<"success" | "error">("success");
    const [mostrarSnackbar, setMostrarSnackbar] = useState(false);

    // Mantenemos referencia para resincronizar si cambia desde el servidor/padre
    const [valorPropAnterior, setValorPropAnterior] = useState(valor);
    if (valorPropAnterior !== valor) {
        setValorPropAnterior(valor);
        // Si el valor actual coincide con el guardado anterior (es decir, el usuario no tiene cambios pendientes
        // sin guardar), actualizamos la referencia guardada al nuevo valor del servidor.
        if (!guardando && valor === valorInicialGuardado) {
            setValorInicialGuardado(valor);
        }
    }

    const huboCambios = valor !== valorInicialGuardado;

    async function confirmar() {
        if (guardando || !huboCambios) {
            return;
        }
        setGuardando(true);
        try {
            await onGuardarValor?.(valor);
            setValorInicialGuardado(valor);
            setTipoAlerta("success");
            setMensajeAlerta("La configuración se guardó correctamente.");
            setMostrarSnackbar(true);
        } catch (error) {
            setTipoAlerta("error");
            setMensajeAlerta(error instanceof Error ? error.message : "Ocurrió un error al guardar la configuración.");
            setMostrarSnackbar(true);
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className={styles.tarjeta}>
            <div className={styles.titulo}>
                {titulo}
            </div>
            <div className={styles.descripcion}>
                {descripcion}
            </div>
            <div className={styles.contenedorEdicion}>
                <TextField 
                    fullWidth 
                    size="small" 
                    type={tipo === "url" ? "url" : "text"} 
                    value={valor} 
                    disabled={guardando} 
                    className={styles.selectMui}
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
                <div className={styles.accionesEdicion}>
                    <IconButton 
                        aria-label="Guardar cambios" 
                        className={`${styles.botonGuardar} ${huboCambios ? styles.botonGuardarActivo : ""}`} 
                        disabled={!huboCambios || guardando} 
                        onClick={confirmar}
                    >
                        <CheckOutlinedIcon />
                    </IconButton>
                </div>
            </div>
            <Snackbar 
                className={styles.avisoSnackbar} 
                open={mostrarSnackbar} 
                autoHideDuration={4000} 
                slots={{ transition: Fade }} 
                transitionDuration={{ enter: 350, exit: 600 }} 
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                onClose={(_, reason) => {
                    if (reason === "clickaway") {
                        return;
                    }
                    setMostrarSnackbar(false);
                }}
            >
                <Alert className={styles.avisoAlerta} severity={tipoAlerta} variant="filled" onClose={() => setMostrarSnackbar(false)}>
                    {mensajeAlerta}
                </Alert>
            </Snackbar>
        </div>
    );
}