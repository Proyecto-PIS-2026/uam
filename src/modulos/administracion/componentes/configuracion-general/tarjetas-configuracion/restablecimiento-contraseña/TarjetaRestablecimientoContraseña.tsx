"use client";

import { useState } from "react";
import { IconButton, Switch } from "@mui/material";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import styles from "./TarjetaRestablecimientoContraseña.module.css";

interface Props {
    titulo: string;
    descripcion: string;
    etiqueta: string;
    habilitado: boolean;
    onGuardar: (habilitado: boolean) => Promise<void>;
}

export default function TarjetaConfiguracionSwitch({titulo, descripcion, etiqueta, habilitado, onGuardar}: Props) {
    const [valor, setValor] = useState(habilitado);
    const [valorGuardado, setValorGuardado] = useState(habilitado);
    const [valorAnterior, setValorAnterior] = useState(habilitado);
    const [guardando, setGuardando] = useState(false);

    const { notificar } = useNotificacionToast();

    if (valorAnterior !== habilitado) {
        setValorAnterior(habilitado);
        setValor(habilitado);
        setValorGuardado(habilitado);
    }

    const huboCambios = valor !== valorGuardado;

    async function guardar() {
        if (guardando || !huboCambios) {
            return;
        }
        setGuardando(true);
        try {
            await onGuardar(valor);
            setValorGuardado(valor);
            notificar("La configuración de restablecimiento de contraseña se guardó correctamente.", "success");
        } catch (error) {
            notificar(error instanceof Error ? error.message: "No se pudo guardar la configuración.", "error");
        } finally {
            setGuardando(false);
        }
    }

    const contenido = (
        <div className={styles.tarjeta}>
            <span className={styles.titulo}>{titulo}</span>
            <span className={styles.descripcion}>{descripcion}</span>
            <div className={styles.filaEdicion}>
                <label className={styles.filaSwitch} data-habilitado={valor} data-guardando={guardando}>
                    <span className={styles.etiqueta}>{etiqueta}</span>
                    <Switch checked={valor} disabled={guardando} onChange={(_, checked) => setValor(checked)} className={styles.switch} slotProps={{input: {role: "switch", "aria-label": etiqueta}}}/>
                </label>
                <IconButton aria-label={`Guardar configuración: ${titulo}`} disabled={guardando || !huboCambios} onClick={guardar} className={styles.botonGuardar}>
                    <CheckOutlinedIcon/>
                </IconButton>
            </div>
        </div>
    );
    return contenido; 
}