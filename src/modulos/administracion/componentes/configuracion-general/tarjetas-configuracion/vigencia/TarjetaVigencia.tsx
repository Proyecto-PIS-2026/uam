"use client";

import { Collapse, Switch, TextField } from "@mui/material";
import { useDespliegueConError } from "../useDespliegueConError";
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
    avisosIndependientes?: boolean;
    configuracion: ConfiguracionVigenciaFotos;
    onChange: (cambios: Partial<ConfiguracionVigenciaFotos>) => void;
    guardando?: boolean;
    modificados?: Partial<Record<keyof ConfiguracionVigenciaFotos, boolean>>;
    errores?: Partial<Record<keyof ConfiguracionVigenciaFotos, boolean>>;
}

export default function TarjetaConfiguracionVigenciaFotos({ titulo = "", descripcion = "", etiquetaVencimiento = "", ayudaVencimiento = "", ayudaAvisos = "", avisosIndependientes = false, configuracion, onChange, guardando = false, modificados = {}, errores = {} }: Props) {
    const avisosDisponibles = avisosIndependientes || configuracion.habilitado;
    const avisosActivos = avisosDisponibles && configuracion.avisosHabilitados;
    const mostrarVigencia = useDespliegueConError(configuracion.habilitado, Boolean(errores.diasVigencia), Boolean(modificados.diasVigencia));
    const mostrarAnticipacion = useDespliegueConError(avisosActivos, Boolean(errores.diasAnticipacion), Boolean(modificados.diasAnticipacion));

    function cambiarDias(campo: "diasVigencia" | "diasAnticipacion", valor: string) {
        if (/^[0-9]*$/.test(valor)) onChange({ [campo]: valor });
    }

    return (
        <div className={styles.tarjeta}>
            {titulo && <span className={styles.titulo}>{titulo}</span>}
            {descripcion && <span className={styles.descripcion}>{descripcion}</span>}
            <div className={styles.opciones}>
                <label className={styles.filaSwitch} data-habilitado={configuracion.habilitado} data-guardando={guardando}
                    data-modificado={Boolean(modificados.habilitado)} data-error={Boolean(errores.habilitado)}>
                    <span className={styles.textoSwitch}>
                        {etiquetaVencimiento && <span className={styles.etiquetaSwitch}>{etiquetaVencimiento}</span>}
                        {ayudaVencimiento && <span className={styles.ayudaSwitch}>{ayudaVencimiento}</span>}
                    </span>
                    <Switch checked={configuracion.habilitado} disabled={guardando} className={styles.switch}
                        onChange={(_, habilitado) => onChange({ habilitado })}
                        slotProps={{ input: { role: "switch", "aria-label": etiquetaVencimiento, "aria-invalid": Boolean(errores.habilitado) } }}
                    />
                </label>
                <Collapse in={mostrarVigencia} timeout={300}>
                    <div className={styles.opcionesDesplegadas}>
                        <TextField required={configuracion.habilitado} fullWidth size="small" label="Días de vigencia"
                            value={configuracion.diasVigencia} disabled={guardando || !mostrarVigencia}
                            onChange={(evento) => cambiarDias("diasVigencia", evento.target.value)} className={styles.selectMui}
                            data-modificado={Boolean(modificados.diasVigencia)} error={Boolean(errores.diasVigencia)}
                            slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*" } }}
                        />
                    </div>
                </Collapse>
                <Collapse in={avisosDisponibles || mostrarAnticipacion} timeout={300}>
                    <div className={styles.opcionesDesplegadas}>
                        <label className={styles.filaSwitch} data-habilitado={configuracion.avisosHabilitados} data-guardando={guardando || !avisosDisponibles}
                            data-modificado={Boolean(modificados.avisosHabilitados)} data-error={Boolean(errores.avisosHabilitados)}>
                            <span className={styles.textoSwitch}>
                                <span className={styles.etiquetaSwitch}>Avisos de próximo vencimiento</span>
                                {ayudaAvisos && <span className={styles.ayudaSwitch}>{ayudaAvisos}</span>}
                            </span>
                            <Switch checked={configuracion.avisosHabilitados} disabled={guardando || !avisosDisponibles} className={styles.switch}
                                onChange={(_, avisosHabilitados) => onChange({ avisosHabilitados })}
                                slotProps={{ input: { role: "switch", "aria-label": "Habilitar avisos de próximo vencimiento", "aria-invalid": Boolean(errores.avisosHabilitados) } }}
                            />
                        </label>
                        <Collapse in={mostrarAnticipacion} timeout={300}>
                            <div className={styles.opcionesDesplegadas}>
                                <TextField required={avisosActivos} fullWidth size="small" label="Días de anticipación del aviso"
                                    value={configuracion.diasAnticipacion} disabled={guardando || !mostrarAnticipacion}
                                    onChange={(evento) => cambiarDias("diasAnticipacion", evento.target.value)} className={styles.selectMui}
                                    data-modificado={Boolean(modificados.diasAnticipacion)} error={Boolean(errores.diasAnticipacion)}
                                    slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*" } }}
                                />
                            </div>
                        </Collapse>
                    </div>
                </Collapse>
            </div>
        </div>
    );
}
