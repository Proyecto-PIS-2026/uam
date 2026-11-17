"use client";

import { Collapse, Switch, TextField } from "@mui/material";
import { useDespliegueConError } from "../../hooks/useDespliegueConError";
import styles from "./TarjetaVigencia.module.css";

export interface ConfiguracionAvisosLocalesFormulario {
    habilitado: boolean;
    diasAnticipacion: string;
}

interface Props {
    configuracion: ConfiguracionAvisosLocalesFormulario;
    onChange: (cambios: Partial<ConfiguracionAvisosLocalesFormulario>) => void;
    guardando?: boolean;
    modificados?: Partial<Record<keyof ConfiguracionAvisosLocalesFormulario, boolean>>;
    errores?: Partial<Record<keyof ConfiguracionAvisosLocalesFormulario, boolean>>;
}

export default function TarjetaAvisosLocales({ configuracion, onChange, guardando = false, modificados = {}, errores = {} }: Props) {
    const mostrarAnticipacion = useDespliegueConError(configuracion.habilitado, Boolean(errores.diasAnticipacion), Boolean(modificados.diasAnticipacion));

    return (
        <div className={styles.tarjeta}>
            <span className={styles.titulo}>Avisos de vencimiento de locales</span>
            <span className={styles.descripcion}>Configurá los avisos para todos los administradores sobre contratos de locales próximos a vencer o vencidos.</span>
            <div className={styles.opciones}>
                <label className={styles.filaSwitch} data-habilitado={configuracion.habilitado} data-guardando={guardando}
                    data-modificado={Boolean(modificados.habilitado)} data-error={Boolean(errores.habilitado)}>
                    <span className={styles.etiquetaSwitch}>Habilitar avisos de vencimiento de locales</span>
                    <Switch checked={configuracion.habilitado} disabled={guardando} className={styles.switch}
                        onChange={(_, habilitado) => onChange({ habilitado })}
                        slotProps={{ input: { role: "switch", "aria-label": "Habilitar avisos de vencimiento de locales", "aria-invalid": Boolean(errores.habilitado) } }}
                    />
                </label>
                <Collapse in={mostrarAnticipacion} timeout={300}>
                    <div className={styles.opcionesDesplegadas}>
                        <TextField required={configuracion.habilitado} fullWidth size="small" label="Días de anticipación del aviso de locales"
                            value={configuracion.diasAnticipacion} disabled={guardando || !mostrarAnticipacion} error={Boolean(errores.diasAnticipacion)}
                            data-modificado={Boolean(modificados.diasAnticipacion)} className={styles.selectMui}
                            slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*" } }}
                            onChange={(evento) => {
                                const diasAnticipacion = evento.target.value;
                                if (/^[0-9]*$/.test(diasAnticipacion)) onChange({ diasAnticipacion });
                            }}
                        />
                    </div>
                </Collapse>
            </div>
        </div>
    );
}
