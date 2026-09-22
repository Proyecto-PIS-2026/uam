import Image from "next/image";
import type { PublicacionListado } from "../../consulta-mercado/acciones/publicaciones";
import styles from "./TarjetaPublicacionSinOperador.module.css";

interface PublicacionSinOperadorProps {
    producto: PublicacionListado;
}

export function PublicacionSinOperador({producto}: PublicacionSinOperadorProps) {
    return (
        <div className={styles.tarjeta}>
            <div className={styles.imagen}>
                {producto.foto ? (<Image src={producto.foto} alt={producto.especie} width={300} height={200}/>) : (<span className={styles.sin_foto}>IMG</span>)}
            </div>
            <div className={styles.contenido}>
                <div className={styles.nombre}>
                    {producto.especie}{" "}{producto.variedad !== "-" && producto.variedad}
                </div>
                <div className={styles.presentacion}>
                    {producto.presentacion}
                </div>
                <div className={styles.bloque_detalle}>
                    <div className={styles.etiquetas}>
                        <span className={styles.etiqueta}>
                            {producto.calibre}
                        </span>
                        <span className={styles.etiqueta}>
                            {producto.categoria}
                        </span>
                    </div>
                    <div className={styles.precio}>
                        {producto.precio !== null ? `$${producto.precio}` : "Sin precio"}
                    </div>
                </div>
            </div>
        </div>
    );
}