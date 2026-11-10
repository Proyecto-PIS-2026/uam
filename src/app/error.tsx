"use client";

import EstadoError from "@/compartido/componentes/EstadoError";
import type { FunctionComponent } from "react";

const ErrorPagina: FunctionComponent<{ error: unknown; reset: () => void; retry?: () => void }> = () => {
    return (
        <EstadoError
            mensaje="No pudimos cargar esta página. Ocurrió un problema inesperado."
        />
    );
};

export default ErrorPagina;
