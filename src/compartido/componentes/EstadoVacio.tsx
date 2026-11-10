import type { ReactNode } from "react";
import styles from "./EstadoVacio.module.css";

type EstadoVacioProps = {
    titulo: string;
    descripcion: string;
    icono: ReactNode;
    compacto?: boolean;
    nivelTitulo?: 2 | 3;
    anunciar?: boolean;
};

export default function EstadoVacio({ titulo, descripcion, icono, compacto = false, nivelTitulo, anunciar = true }: EstadoVacioProps) {
    const Titulo = nivelTitulo === 2 ? "h2" : nivelTitulo === 3 ? "h3" : "p";
    return (
        <div role={anunciar ? "status" : undefined} className={`${styles.contenedor}${compacto ? ` ${styles.compacto}` : ""}`}>
            <div className={styles.icono} aria-hidden="true">{icono}</div>
            <div className={styles.textos}>
                <Titulo className={styles.titulo}>{titulo}</Titulo>
                <p className={styles.descripcion}>{descripcion}</p>
            </div>
        </div>
    );
}
