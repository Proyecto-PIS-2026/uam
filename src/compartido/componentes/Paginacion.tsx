"use client";

import { useId } from "react";
import Pagination, { type PaginationProps } from "@mui/material/Pagination";
import useMediaQuery from "@mui/material/useMediaQuery";
import styles from "./Paginacion.module.css";

type PaginacionProps = {
    pagina: number;
    totalPaginas: number;
    alCambiar: (pagina: number) => void;
    etiqueta: string;
    resumen?: string;
};

const obtenerEtiquetaBoton: NonNullable<PaginationProps["getItemAriaLabel"]> = (tipo, pagina) => {
    switch (tipo) {
        case "page": return `Página ${pagina}`;
        case "previous": return "Anterior";
        case "next": return "Siguiente";
        case "first": return "Primera página";
        case "last": return "Última página";
        default: return "Más páginas";
    }
};

export default function Paginacion({ pagina, totalPaginas, alCambiar, etiqueta, resumen }: PaginacionProps) {
    const esMobile = useMediaQuery("(max-width: 500px)");
    const resumenId = useId();

    if (totalPaginas <= 1) return null;

    return (
        <div className={styles.contenedor}>
            <Pagination
                className={styles.controles}
                count={totalPaginas}
                page={pagina}
                onChange={(_, nuevaPagina) => alCambiar(nuevaPagina)}
                color="secondary"
                shape="rounded"
                size={esMobile ? "small" : "medium"}
                siblingCount={esMobile ? 0 : 1}
                aria-label={etiqueta}
                aria-describedby={resumenId}
                getItemAriaLabel={obtenerEtiquetaBoton}
            />
            <p id={resumenId} className={styles.resumen} aria-live="polite" aria-atomic="true">
                <span>Página {pagina} de {totalPaginas}</span>
                {resumen && <span>{resumen}</span>}
            </p>
        </div>
    );
}
