import styles from "./ComentarioPublicacion.module.css";

type ComentarioPublicacionProps = {
    comentario?: string | null;
};

export default function ComentarioPublicacion({ comentario }: ComentarioPublicacionProps) {
    return (
        <section className={styles.contenedor} aria-label="Comentario">
            <h2 className={styles.titulo}>Comentario</h2>
            <p className={styles.texto}>{comentario?.trim() || "-"}</p>
        </section>
    );
}
