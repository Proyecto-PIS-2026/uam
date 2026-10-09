import HojasDecorativas from "./HojasDecorativas";
import styles from "./EncabezadoPagina.module.css";

type EncabezadoPaginaProps = {
    titulo: string;
    cantidad?: number;
    subtitulo: string;
    className?: string;
};

export default function EncabezadoPagina({ titulo, cantidad, subtitulo, className = "" }: EncabezadoPaginaProps) {
    return (
        <header className={`${styles.encabezado} ${className}`}>
            <HojasDecorativas variante="separador" />
            <div className={styles.contenido}>
                <h1 className={styles.titulo}>{titulo}</h1>
                <p className={styles.subtitulo}><span className={styles.cantidad}>{cantidad}</span>{" "}{subtitulo}</p>
            </div>
        </header>
    );
}
