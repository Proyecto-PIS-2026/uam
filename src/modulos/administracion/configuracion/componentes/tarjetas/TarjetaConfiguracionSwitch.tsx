"use client";

import { Switch } from "@mui/material";
import styles from "./TarjetaConfiguracionSwitch.module.css";

interface Props {
    titulo: string;
    descripcion?: string;
    etiqueta: string;
    habilitado: boolean;
    onChange: (habilitado: boolean) => void;
    guardando?: boolean;
    modificado?: boolean;
}

export default function TarjetaConfiguracionSwitch({ titulo, descripcion, etiqueta, habilitado, onChange, guardando = false, modificado = false }: Props) {
    return (
        <div className={styles.tarjeta}>
            <span className={styles.titulo}>{titulo}</span>
            {descripcion && <span className={styles.descripcion}>{descripcion}</span>}
            <div className={styles.filaEdicion}>
                <label className={styles.filaSwitch} data-habilitado={habilitado} data-guardando={guardando} data-modificado={modificado}>
                    <span className={styles.etiqueta}>{etiqueta}</span>
                    <Switch checked={habilitado} disabled={guardando} onChange={(_, checked) => onChange(checked)}
                        className={styles.switch} slotProps={{ input: { role: "switch", "aria-label": etiqueta } }}
                    />
                </label>
            </div>
        </div>
    );
}
