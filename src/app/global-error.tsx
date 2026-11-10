"use client";

import "@/estilos/globals.css";
import type { FunctionComponent } from "react";
import EstadoError from "@/compartido/componentes/EstadoError";
import styles from "@/compartido/componentes/EstadoError.module.css";

const ErrorGlobal: FunctionComponent<{ error: unknown; reset: () => void; retry?: () => void }> = () => {
    return (
        <html lang="es">
            <head>
                <title>No pudimos cargar UAM</title>
            </head>
            <body className={styles.documento}>
                <EstadoError
                    mensaje="No pudimos cargar UAM. Ocurrió un problema al abrir la aplicación."
                />
            </body>
        </html>
    );
};

export default ErrorGlobal;
