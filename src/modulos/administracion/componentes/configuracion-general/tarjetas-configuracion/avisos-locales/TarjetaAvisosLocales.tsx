"use client";

import { useState } from "react";
import { IconButton, Switch, TextField } from "@mui/material";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import { validarAnticipacionAvisoLocales } from "@/modulos/usuarios/operadores/configuracion-avisos-locales";
import styles from "../vigencia/TarjetaVigencia.module.css";

export interface ConfiguracionAvisosLocalesFormulario {
    habilitado: boolean;
    diasAnticipacion: string;
}

interface Props {
    configuracion: ConfiguracionAvisosLocalesFormulario;
    onGuardar: (configuracion: ConfiguracionAvisosLocalesFormulario) => Promise<void>;
}

function sonIguales(primera: ConfiguracionAvisosLocalesFormulario, segunda: ConfiguracionAvisosLocalesFormulario) {
    return primera.habilitado === segunda.habilitado && primera.diasAnticipacion === segunda.diasAnticipacion;
}

export default function TarjetaAvisosLocales({ configuracion, onGuardar }: Props) {
    const [valores, setValores] = useState(configuracion);
    const [guardado, setGuardado] = useState(configuracion);
    const [configuracionAnterior, setConfiguracionAnterior] = useState(configuracion);
    const [guardando, setGuardando] = useState(false);
    const [anticipacionInvalida, setAnticipacionInvalida] = useState(false);
    const { notificar } = useNotificacionToast();

    if (!sonIguales(configuracionAnterior, configuracion)) {
        setConfiguracionAnterior(configuracion);
        setValores(configuracion);
        setGuardado(configuracion);
        setAnticipacionInvalida(false);
    }

    const huboCambios = !sonIguales(valores, guardado);

    async function guardar() {
        if (guardando || !huboCambios) return;
        let diasAnticipacion = valores.diasAnticipacion;
        try {
            validarAnticipacionAvisoLocales(diasAnticipacion);
        } catch (error) {
            if (valores.habilitado) {
                setAnticipacionInvalida(true);
                notificar(!diasAnticipacion ? "Faltan completar campos." : error instanceof Error ? error.message : "La anticipación no es válida.", "error");
                return;
            }
            diasAnticipacion = guardado.diasAnticipacion;
        }
        const nuevaConfiguracion = { habilitado: valores.habilitado, diasAnticipacion: String(Number(diasAnticipacion)) };
        setGuardando(true);
        try {
            await onGuardar(nuevaConfiguracion);
            setValores(nuevaConfiguracion);
            setGuardado(nuevaConfiguracion);
            setAnticipacionInvalida(false);
            notificar("La configuración de avisos de locales se guardó correctamente.", "success");
        } catch (error) {
            notificar(error instanceof Error ? error.message : "No se pudo guardar la configuración.", "error");
        } finally {
            setGuardando(false);
        }
    }

    return (
        <form className={styles.tarjeta} noValidate onSubmit={(evento) => { evento.preventDefault(); void guardar(); }}>
            <span className={styles.titulo}>Avisos de vencimiento de locales</span>
            <span className={styles.descripcion}>Configurá los avisos para todos los administradores sobre contratos de locales próximos a vencer o vencidos.</span>
            <div className={styles.filaEdicion}>
                <div className={styles.opciones}>
                    <label className={styles.filaSwitch} data-habilitado={valores.habilitado} data-guardando={guardando}>
                        <span className={styles.etiquetaSwitch}>Habilitar avisos de vencimiento de locales</span>
                        <Switch checked={valores.habilitado} disabled={guardando} className={styles.switch}
                            onChange={(_, habilitado) => {
                                setValores((actual) => ({ ...actual, habilitado }));
                                setAnticipacionInvalida(false);
                            }}
                            slotProps={{ input: { role: "switch", "aria-label": "Habilitar avisos de vencimiento de locales" } }}
                        />
                    </label>
                    <div className={styles.opcionesDesplegadas}>
                        <TextField required={valores.habilitado} fullWidth size="small" label="Días de anticipación del aviso de locales"
                            value={valores.diasAnticipacion} disabled={guardando || !valores.habilitado} error={anticipacionInvalida}
                            className={styles.selectMui} slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*" } }}
                            onChange={(evento) => {
                                const diasAnticipacion = evento.target.value;
                                if (!/^[0-9]*$/.test(diasAnticipacion)) return;
                                setValores((actual) => ({ ...actual, diasAnticipacion }));
                                setAnticipacionInvalida(false);
                            }}
                        />
                    </div>
                </div>
                <IconButton type="submit" aria-label="Guardar configuración: Avisos de vencimiento de locales"
                    disabled={guardando || !huboCambios} className={styles.botonGuardar}>
                    <CheckOutlinedIcon />
                </IconButton>
            </div>
        </form>
    );
}
