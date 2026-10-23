"use client";

import EstadoError from "@/compartido/componentes/EstadoError";
import type { FunctionComponent } from "react";

const ErrorMiMercado: FunctionComponent<{ error?: unknown; reset: () => void; retry?: () => void }> = () => {
    return (
        <EstadoError
            mensaje="No se pudieron cargar tus publicaciones."
        />
    );
};

export default ErrorMiMercado;
