"use client";

import { useId, useState } from "react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import CheckIcon from "@mui/icons-material/Check";
import BotonDesplegable from "./BotonDesplegable";
import styles from "./BotonOrdenar.module.css";

type BotonOrdenarProps<T extends string> = {
    valor: T;
    opciones: readonly { valor: T; etiqueta: string }[];
    alCambiar: (valor: T) => void;
    className?: string;
};

export default function BotonOrdenar<T extends string>({ valor, opciones, alCambiar, className }: BotonOrdenarProps<T>) {
    const id = useId();
    const [ancla, setAncla] = useState<HTMLElement | null>(null);
    const abierto = ancla !== null;
    const idBoton = `${id}-ordenar`;
    const idMenu = `${id}-opciones-orden`;

    function cerrar() {
        setAncla(null);
    }

    return (
        <>
            <BotonDesplegable
                id={idBoton}
                abierto={abierto}
                className={className}
                aria-haspopup="menu"
                aria-controls={abierto ? idMenu : undefined}
                onClick={(evento) => setAncla(evento.currentTarget)}
            >
                Ordenar por
            </BotonDesplegable>
            <Menu
                anchorEl={ancla}
                open={abierto}
                onClose={cerrar}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                    list: { id: idMenu, "aria-labelledby": idBoton },
                    paper: { sx: { minWidth: "10rem", maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } },
                }}
            >
                {opciones.map((opcion) => (
                    <MenuItem
                        key={opcion.valor}
                        role="menuitemradio"
                        selected={opcion.valor === valor}
                        className={styles.opcion}
                        onClick={() => {
                            cerrar();
                            alCambiar(opcion.valor);
                        }}
                    >
                        <span className={styles.textoOpcion}>{opcion.etiqueta}</span>
                        <span className={styles.marca} aria-hidden="true">
                            {opcion.valor === valor && <CheckIcon fontSize="small" />}
                        </span>
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}
