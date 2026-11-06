"use client";

import Link from "next/link";
import styles from "./EstadoError.module.css";

type EstadoErrorProps = {
    mensaje: string;
};

export default function EstadoError({ mensaje }: EstadoErrorProps) {
    return (
        <main className={styles.pagina}>
            <section className={styles.contenedor} aria-labelledby="titulo-error">
                <h1 id="titulo-error" className={styles.titulo}>Error</h1>
                <p className={styles.mensaje}>{mensaje}</p>
                <Link href="/" className={styles.boton}>Ir al inicio</Link>
            </section>
        </main>
    );
}
