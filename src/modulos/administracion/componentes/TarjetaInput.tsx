"use client";

import { useId, useState } from "react";
import { IconButton, TextField } from "@mui/material";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import NotificacionToast, { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";

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

export default function TarjetaInput({ titulo, descripcion, label, valor = "", tipo = "numero", onChangeValor, onGuardarValor }: TarjetaInputProps) {
    const id = useId();
    const [guardando, setGuardando] = useState(false);
    const [valorInicialGuardado, setValorInicialGuardado] = useState(valor);
    const { notificacion, notificar, cerrarNotificacion } = useNotificacionToast();

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
            notificar("La configuración se guardó correctamente.", "success");
        } catch (error) {
            notificar(error instanceof Error ? error.message : "Ocurrió un error al guardar la configuración.", "error");
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className={styles.tarjeta}>
            <div id={`${id}-titulo`} className={styles.titulo}>
                {titulo}
            </div>
            <div id={`${id}-descripcion`} className={styles.descripcion}>
                {descripcion}
            </div>
            <div className={styles.contenedorEdicion}>
                <TextField 
                    fullWidth 
                    size="small" 
                    label={label}
                    type={tipo === "url" ? "url" : "text"} 
                    value={valor} 
                    disabled={guardando} 
                    className={styles.selectMui}
                    slotProps={{
                        htmlInput: {
                            "aria-labelledby": label ? undefined : `${id}-titulo`,
                            "aria-describedby": `${id}-descripcion`,
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
            <NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} />
        </div>
    );
}
