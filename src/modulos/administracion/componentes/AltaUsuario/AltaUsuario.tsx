"use client";

import { useState, type MouseEvent } from "react";
import { MenuItem, Select, ToggleButton, ToggleButtonGroup } from "@mui/material";
import type { TipoUsuario } from "../Compartidos/Tipos";
import AltaAdministrador from "./AltaAdministrador";
import AltaProductor from "./AltaProductor";
import AltaOperador from "./AltaOperador";
import styles from "./AltaUsuario.module.css";

export default function AltaUsuario() {
    const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario>("ADMINISTRADOR");

    function cambiarTipoUsuario(_: MouseEvent<HTMLElement>, nuevoTipo: TipoUsuario | null) {
        if (nuevoTipo) setTipoUsuario(nuevoTipo);
    }

    return (
        <section className={styles.tarjeta}>
            <h2 className={styles.titulo}>Alta de usuario</h2>

            <ToggleButtonGroup value={tipoUsuario} exclusive onChange={cambiarTipoUsuario} aria-label="Tipo de usuario" className={styles.selector}>
                <ToggleButton value="ADMINISTRADOR">Administrador</ToggleButton>
                <ToggleButton value="OPERADOR">Operador</ToggleButton>
                <ToggleButton value="PRODUCTOR">Productor</ToggleButton>
            </ToggleButtonGroup>

            <Select value={tipoUsuario} onChange={(evento) => 
                setTipoUsuario(evento.target.value as TipoUsuario)} className={styles.selectorMovil} aria-label="Tipo de usuario" size="small"
            >
                <MenuItem value="ADMINISTRADOR">Administrador</MenuItem>
                <MenuItem value="OPERADOR">Operador</MenuItem>
                <MenuItem value="PRODUCTOR">Productor</MenuItem>
            </Select>

            <div className={styles.contenido}>
                {tipoUsuario === "ADMINISTRADOR" && <AltaAdministrador />}
                {tipoUsuario === "OPERADOR" && <AltaOperador />}
                {tipoUsuario === "PRODUCTOR" && <AltaProductor />}
            </div>
        </section>
    );
}