"use client";

import type { ReactNode } from "react";
import MuiDrawer from "@mui/material/Drawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import styles from "../modulos/publicaciones/operadores/componentes/DrawerEditarPublicacion.module.css";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
};

export default function Drawer({ isOpen, onClose, children }: Props) {
    const esWeb = useMediaQuery("(min-width: 768px)");

    return (
        <MuiDrawer
            anchor={esWeb ? "right" : "bottom"}
            open={isOpen}
            onClose={onClose}
            slotProps={{ paper: { className: styles.panel, role: "dialog", "aria-modal": true, "aria-label": "Detalle de publicación" } }}
        >
            <div className={styles.asa} aria-hidden="true" />
            <div className={styles.encabezado} style={{ justifyContent: "flex-end" }}>
                <button
                    type="button"
                    className={styles.cerrar}
                    onClick={onClose}
                    aria-label="Cerrar"
                >
                    <CloseIcon fontSize="small" />
                </button>
            </div>
            <div className={styles.cuerpo}>{children}</div>
        </MuiDrawer>
    );
}
