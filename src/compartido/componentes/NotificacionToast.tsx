"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Fade from "@mui/material/Fade";
import Portal from "@mui/material/Portal";
import Snackbar from "@mui/material/Snackbar";
import styles from "./NotificacionToast.module.css";

type TipoNotificacion = "success" | "error" | "warning" | "info";

type Notificacion = {
    id: number;
    mensaje: string;
    tipo: TipoNotificacion;
};

export function useNotificacionToast() {
    const [notificacion, setNotificacion] = useState<Notificacion | null>(null);
    const siguienteId = useRef(0);

    const notificar = useCallback((mensaje: string, tipo: TipoNotificacion) => {
        if (!mensaje.trim()) return;
        siguienteId.current += 1;
        setNotificacion({ id: siguienteId.current, mensaje, tipo });
    }, []);

    const cerrarNotificacion = useCallback(() => setNotificacion(null), []);

    return { notificacion, notificar, cerrarNotificacion };
}

type Props = {
    notificacion: Notificacion | null;
    alCerrar: () => void;
};

export default function NotificacionToast({ notificacion, alCerrar }: Props) {
    useEffect(() => {
        if (!notificacion) return;

        // El aviso se cierra antes de que Escape llegue al panel que está debajo.
        const cerrarConEscape = (evento: KeyboardEvent) => {
            if (evento.key !== "Escape" || evento.defaultPrevented) return;
            evento.preventDefault();
            evento.stopPropagation();
            alCerrar();
        };
        document.addEventListener("keydown", cerrarConEscape, true);
        return () => document.removeEventListener("keydown", cerrarConEscape, true);
    }, [notificacion, alCerrar]);

    if (!notificacion) return null;

    const urgente = notificacion.tipo === "error" || notificacion.tipo === "warning";

    return (
        <Portal>
            <Snackbar
                key={notificacion.id}
                className={styles.contenedor}
                open
                autoHideDuration={6000}
                resumeHideDuration={6000}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                slots={{ transition: Fade }}
                transitionDuration={200}
                onClose={(_, motivo) => { if (motivo !== "clickaway") alCerrar(); }}
            >
                <Alert
                    className={`${styles.alerta} ${styles[notificacion.tipo]}`}
                    severity={notificacion.tipo}
                    variant="filled"
                    role={urgente ? "alert" : "status"}
                    aria-live={urgente ? "assertive" : "polite"}
                    aria-atomic="true"
                    closeText="Cerrar notificación"
                    onClose={alCerrar}
                >
                    {notificacion.mensaje}
                </Alert>
            </Snackbar>
        </Portal>
    );
}
