"use client";

import { useState } from "react";
import { Collapse, IconButton, Switch, TextField } from "@mui/material";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import styles from "./TarjetaVigencia.module.css";

export interface ConfiguracionVigenciaFotos {
    habilitado: boolean;
    diasVigencia: string;
    avisosHabilitados: boolean;
    diasAnticipacion: string;
}

interface Props {
    titulo?: string;
    descripcion?: string;
    etiquetaVencimiento?: string;
    ayudaVencimiento?: string;
    ayudaAvisos?: string;
    maximoDiasVigencia?: number;
    configuracion: ConfiguracionVigenciaFotos;
    onGuardar: (configuracion: ConfiguracionVigenciaFotos) => Promise<void>;
}

function sonIguales(primera: ConfiguracionVigenciaFotos, segunda: ConfiguracionVigenciaFotos) {
    return (primera.habilitado === segunda.habilitado && primera.diasVigencia === segunda.diasVigencia && primera.avisosHabilitados === segunda.avisosHabilitados && primera.diasAnticipacion === segunda.diasAnticipacion);
}

function validarDias(valor: string, campo: "vigencia" | "anticipación", maximo?: number): string | null {
    if (!/^[0-9]+$/.test(valor) || Number(valor) <= 0) {
        return `La ${campo} debe ser un número entero mayor que cero.`;
    }
    if (!Number.isSafeInteger(Number(valor))) {
        return `La ${campo} ingresada es demasiado grande.`;
    }
    if (maximo !== undefined && Number(valor) > maximo) {
        return `La ${campo} no puede superar los ${maximo} días.`;
    }
    return null;
}

export default function TarjetaConfiguracionVigenciaFotos({ titulo = "", descripcion = "", etiquetaVencimiento = "", ayudaVencimiento = "", ayudaAvisos = "", maximoDiasVigencia, configuracion, onGuardar }: Props) {
    const [valores, setValores] = useState(configuracion);
    const [guardado, setGuardado] = useState(configuracion);
    const [configuracionAnterior, setConfiguracionAnterior] = useState(configuracion);
    const [guardando, setGuardando] = useState(false);

    const { notificar } = useNotificacionToast();

    if (!sonIguales(configuracionAnterior, configuracion)) {
        setConfiguracionAnterior(configuracion);
        setValores(configuracion);
        setGuardado(configuracion);
    }

    const huboCambios = !sonIguales(valores, guardado);

    function cambiarDias(campo: "diasVigencia" | "diasAnticipacion", valor: string) {
        if (!/^[0-9]*$/.test(valor)) {
            return;
        }
        setValores((actual) => ({...actual, [campo]: valor}));
    }

    async function guardar() {
        if (guardando || !huboCambios) {
            return;
        }
        const errorVigencia = valores.habilitado ? validarDias(valores.diasVigencia, "vigencia", maximoDiasVigencia) : null;
        if (errorVigencia) {
            notificar(errorVigencia, "error");
            return;
        }

        const avisosActivos = valores.habilitado && valores.avisosHabilitados;
        const errorAnticipacion = avisosActivos ? validarDias(valores.diasAnticipacion, "anticipación") : null;
        if (errorAnticipacion) {
            notificar(errorAnticipacion, "error");
            return;
        }
        if (avisosActivos && Number(valores.diasAnticipacion) >= Number(valores.diasVigencia)) {
            notificar("La anticipación debe ser menor que la vigencia.", "error");
            return;
        }
        const nuevaConfiguracion: ConfiguracionVigenciaFotos = {
            habilitado: valores.habilitado,
            avisosHabilitados: avisosActivos,
            diasVigencia: valores.habilitado ? String(Number(valores.diasVigencia)) : "",
            diasAnticipacion: avisosActivos ? String(Number(valores.diasAnticipacion)) : "",
        };
        setGuardando(true);
        try {
            await onGuardar(nuevaConfiguracion);
            setValores(nuevaConfiguracion);
            setGuardado(nuevaConfiguracion);
            notificar("La configuración de vigencia se guardó correctamente.", "success");
        } catch (error) {
            notificar(error instanceof Error ? error.message : "No se pudo guardar la configuración.", "error");
        } finally {
            setGuardando(false);
        }
    }

    const contenido = (
        <form className={styles.tarjeta} noValidate onSubmit={(evento) => { evento.preventDefault(); void guardar(); }}>
            {titulo && <span className={styles.titulo}>{titulo}</span>}
            {descripcion && <span className={styles.descripcion}>{descripcion}</span>}
            <div className={styles.filaEdicion}>
                <div className={styles.opciones}>
                    <label className={styles.filaSwitch} data-habilitado={valores.habilitado} data-guardando={guardando}>
                        <span className={styles.textoSwitch}>
                            {etiquetaVencimiento && (
                                <span className={styles.etiquetaSwitch}>
                                    {etiquetaVencimiento}
                                </span>
                            )}
                            {ayudaVencimiento && (
                                <span className={styles.ayudaSwitch}>
                                    {ayudaVencimiento}
                                </span>
                            )}
                        </span>
                        <Switch checked={valores.habilitado} disabled={guardando} className={styles.switch}
                            onChange={(_, checked) => {setValores((actual) => ({...actual, habilitado: checked, diasVigencia: checked ? actual.diasVigencia : "", avisosHabilitados: checked ? actual.avisosHabilitados : false, diasAnticipacion: checked ? actual.diasAnticipacion : ""}))}}
                            slotProps={{input: {role: "switch", "aria-label": etiquetaVencimiento}}}
                        />
                    </label>               
                    <Collapse in={valores.habilitado} timeout={300}>
                        <div className={styles.opcionesDesplegadas}>
                            <TextField required={valores.habilitado} fullWidth size="small" label="Días de vigencia" value={valores.diasVigencia} disabled={guardando || !valores.habilitado}
                                onChange={(evento) => cambiarDias("diasVigencia", evento.target.value)}
                                className={styles.selectMui}
                                slotProps={{htmlInput: {inputMode: "numeric", pattern: "[0-9]*"}}}
                            />
                            <label className={styles.filaSwitch} data-habilitado={valores.avisosHabilitados} data-guardando={guardando || !valores.habilitado}>
                                <span className={styles.textoSwitch}>
                                    <span className={styles.etiquetaSwitch}>
                                        Avisos de próximo vencimiento
                                    </span>
                                    <span className={styles.ayudaSwitch}>
                                        {ayudaAvisos}
                                    </span>
                                </span>
                                <Switch checked={valores.avisosHabilitados} disabled={guardando || !valores.habilitado} className={styles.switch}
                                    onChange={(_, checked) => {setValores((actual) => ({...actual, avisosHabilitados: checked, diasAnticipacion: checked ? actual.diasAnticipacion : ""}))}}
                                    slotProps={{input: {role: "switch", "aria-label": "Habilitar avisos de próximo vencimiento"}}}
                                />
                            </label>
                            <Collapse in={valores.avisosHabilitados} timeout={300}>
                                <div className={styles.anticipacionDesplegada}>
                                    <TextField required={valores.habilitado && valores.avisosHabilitados} fullWidth size="small" label="Días de anticipación del aviso" value={valores.diasAnticipacion} disabled={guardando || !valores.habilitado || !valores.avisosHabilitados} onChange={(evento) =>cambiarDias("diasAnticipacion", evento.target.value)} className={styles.selectMui} slotProps={{htmlInput: {inputMode: "numeric", pattern: "[0-9]*"}}}/>
                                </div>
                            </Collapse>
                        </div>
                    </Collapse>
                </div>
                <IconButton type="submit" aria-label={`Guardar configuración: ${titulo}`} disabled={guardando || !huboCambios} className={styles.botonGuardar}>
                    <CheckOutlinedIcon />
                </IconButton>
            </div>
        </form>
    );
    return contenido; 
}
