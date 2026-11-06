"use client";

import { useId, useState } from "react";
import { IconButton, TextField } from "@mui/material";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";

import styles from "./TarjetaInput.module.css";

interface TarjetaInputProps { 
    titulo: string; 
    descripcion: string;
    label?: string;
    valor?: string;
    tipo?: "numero" | "url";
    mensajeExito?: string;
    onChangeValor?: (valor: string) => void;
    onGuardarValor?: (valor: string) => Promise<void>;
}

export default function TarjetaInput({ titulo, descripcion, label, valor = "", tipo = "numero", mensajeExito = "", onChangeValor, onGuardarValor }: TarjetaInputProps) {
    const id = useId();
    const [guardando, setGuardando] = useState(false);
    const [valorInicialGuardado, setValorInicialGuardado] = useState(valor);
    const { notificar } = useNotificacionToast();

    const [valorPropAnterior, setValorPropAnterior] = useState(valor);
    if (valorPropAnterior !== valor) {
        setValorPropAnterior(valor);
        if (!guardando && valor === valorInicialGuardado) {
            setValorInicialGuardado(valor);
        }
    }

    const huboCambios = valor !== valorInicialGuardado;

    async function confirmar() {
        if (guardando || !huboCambios) {
            return;
        }
        if (tipo === "numero" && (!/^[0-9]+$/.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) <= 0)) {
            notificar("El importe debe ser un número entero positivo.", "error");
            return;
        }
        if (tipo === "url" && valor !== "") {
            let url: URL;
            try {
                url = new URL(valor);
            } catch {
                notificar("La URL de la Lista Inteligente no es válida.", "error");
                return;
            }
            if (valor !== valor.trim() || !["http:", "https:"].includes(url.protocol) || !url.hostname || !url.pathname.toLowerCase().endsWith(".pdf")) {
                notificar("La URL de la Lista Inteligente no es válida.", "error"); 
                return;
            }
        }
        setGuardando(true);
        try {
            await onGuardarValor?.(valor);
            setValorInicialGuardado(valor);
            notificar(mensajeExito, "success");
        } catch (error) {
            notificar(error instanceof Error ? error.message : "Ocurrió un error al guardar la configuración.", "error");
        } finally {
            setGuardando(false);
        }
    }

    const contenido = (
        <div className={styles.tarjeta}>
            <div id={`${id}-titulo`} className={styles.titulo}>
                {titulo}
            </div>
            <div id={`${id}-descripcion`} className={styles.descripcion}>
                {descripcion}
            </div>
            <div className={styles.contenedorEdicion}>
                <TextField  fullWidth size="small" label={label} type={tipo === "url" ? "url" : "text"}  value={valor}  disabled={guardando} className={styles.selectMui}
                    slotProps={{htmlInput: {"aria-labelledby": label ? undefined : `${id}-titulo`, "aria-describedby": `${id}-descripcion`, inputMode: tipo === "url" ? "url" : "numeric", pattern: tipo === "url" ? undefined : "[0-9]*"}}}
                    onChange={(evento) => {
                        const nuevoValor = evento.target.value;
                        if (tipo === "url" || /^[0-9]*$/.test(nuevoValor)) {
                            onChangeValor?.(nuevoValor);
                        }
                    }}
                />
                <div className={styles.accionesEdicion}>
                    <IconButton aria-label="Guardar cambios" className={`${styles.botonGuardar} ${huboCambios ? styles.botonGuardarActivo : ""}`} disabled={!huboCambios || guardando} onClick={confirmar}>
                        <CheckOutlinedIcon />
                    </IconButton>
                </div>
            </div>
        </div>
    );
    return contenido
}
