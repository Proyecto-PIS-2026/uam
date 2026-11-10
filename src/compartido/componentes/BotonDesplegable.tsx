"use client";

import Button, { type ButtonProps } from "@mui/material/Button";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import styles from "./BotonDesplegable.module.css";

type Props = Omit<ButtonProps, "variant" | "size" | "startIcon" | "endIcon" | "aria-expanded"> & {
    abierto: boolean;
};

export default function BotonDesplegable({ abierto, children, className, type = "button", ...props }: Props) {
    return (
        <Button
            {...props}
            type={type}
            variant="text"
            size="small"
            className={`${styles.boton} ${className ?? ""}`}
            aria-expanded={abierto}
            endIcon={<KeyboardArrowDownIcon aria-hidden="true" className={`${styles.flecha} ${abierto ? styles.flechaAbierta : ""}`} />}
        >
            {children}
        </Button>
    );
}
