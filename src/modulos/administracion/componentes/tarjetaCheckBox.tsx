"use client";

import { useEffect, useRef, useState } from "react";
import { Checkbox, FormControlLabel, IconButton, TextField } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import ConfiguracionFotoEspecie from "./tarjetaUploadFotoEspecie";
import styles from "./tarjetaConfiguracion.module.css";

interface TarjetaCheckBoxProps {
    titulo: string;
    descripcion: string;
    label?: string;
    valor?: string;
    checked?: boolean;
    onChangeValor?: (valor: string) => void;
    onChangeChecked?: (valor: boolean) => void;
}

export default function TarjetaCheckBoxProps({ titulo,descripcion, tipo, label, valor = "", checked = false, especies = [], especieSeleccionada = "", onChangeValor, onChangeChecked, onChangeArchivo, onChangeEspecie }: TarjetaCheckBoxProps) {
    const [editando, setEditando] = useState(false);
    const [valorAnterior, setValorAnterior] = useState(valor);
    const referenciaTarjeta = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function manejarClickFuera(evento: MouseEvent) {
            if (editando && referenciaTarjeta.current && !referenciaTarjeta.current.contains(evento.target as Node)) {
                onChangeValor?.(valorAnterior);
                setEditando(false);
            }
        }
        document.addEventListener("mousedown", manejarClickFuera);
        return () => {
            document.removeEventListener("mousedown", manejarClickFuera);
        };
    }, [editando, valorAnterior, onChangeValor]);

    const contenido = (
        <div className={styles.tarjeta}>
            <div className={styles.titulo}>{titulo}</div>
            <div className={styles.descripcion}>{descripcion}</div>
            {tipo === "input" && (
                <div ref={referenciaTarjeta} className={styles.contenedorEdicion}>
                    <TextField fullWidth size="small" label={label} type="text" value={valor} disabled={!editando} className={styles.selectMui}
                        slotProps={{
                            htmlInput: {
                                inputMode: "numeric",
                                pattern: "[0-9]*",
                            },
                        }}
                        onChange={(evento) => {
                            const nuevoValor = evento.target.value;
                            if (/^[0-9]*$/.test(nuevoValor)) {
                                onChangeValor?.(nuevoValor);
                            }
                        }}
                    />
                    {!editando ? (
                        <IconButton aria-label="Editar" className={styles.botonAccion} onClick={() => { setValorAnterior(valor); setEditando(true) }} >
                            <EditOutlinedIcon />
                        </IconButton>
                    ) : (
                        <div className={styles.accionesEdicion}>
                            <IconButton aria-label="Guardar"  className={styles.botonGuardar} onClick={() => { setEditando(false) }} >
                                <CheckOutlinedIcon />
                            </IconButton>
                            <IconButton aria-label="Descartar cambios" className={styles.botonDescartar} onClick={() => { onChangeValor?.(valorAnterior); setEditando(false) }} >
                                <CloseOutlinedIcon />
                            </IconButton>
                        </div>
                    )}
                </div>
            )}
            {tipo === "checkbox" && (
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={checked}
                            onChange={(evento) =>
                                onChangeChecked?.(
                                    evento.target.checked,
                                )
                            }
                        />
                    }
                    label={label}
                />
            )}

            {tipo === "foto-especie" && (
                <ConfiguracionFotoEspecie
                    especies={especies}
                    especieSeleccionada={especieSeleccionada}
                    onChangeEspecie={(id) =>
                        onChangeEspecie?.(id)
                    }
                    onChangeArchivo={(archivo) =>
                        onChangeArchivo?.(archivo)
                    }
                />
            )}
        </div>
    );
    return contenido; 
}