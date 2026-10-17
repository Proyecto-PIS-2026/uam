"use client";

import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import type { PublicacionMiMercadoProductor } from "../consultas-mi-mercado-productor";
import styles from "./TarjetaPublicacion.module.css";

type Props = {
    publicacion: PublicacionMiMercadoProductor;
    alConsultar: () => void;
};

export default function TarjetaPublicacionProductor({ publicacion, alConsultar }: Props) {
    const variedad = publicacion.presentacion.variedad.nombreVariedad;
    const especie = publicacion.presentacion.variedad.especie.nombreEspecie;
    const nombreProducto = variedad && variedad.trim() !== "" && variedad.trim() !== "-" ? `${especie} · ${variedad}` : especie;

    return (
        <button type="button" onClick={alConsultar} className={`${styles.tarjeta} ${styles.tarjetaConsulta}`} aria-label={`Ver detalle de ${nombreProducto}`}>
            <span className={styles.botonFoto}>
                <ImagenPublicacion src={publicacion.foto} alt={nombreProducto} fill sizes="(min-width: 768px) 320px, 128px" unoptimized className={styles.foto} reemplazo={<span className={styles.sinFoto}>Sin fotografía</span>} />
            </span>
            <span className={styles.contenido}>
                <span className={styles.botonInformacion}>
                    <span className={styles.informacion}>
                        <span className={styles.encabezadoProducto}>
                            <span className={styles.nombreProducto} title={nombreProducto}>{nombreProducto}</span>
                            <span className={`${styles.estado} ${publicacion.publicacionDisponible ? styles.disponible : styles.noDisponible}`}>
                                {publicacion.publicacionDisponible ? "Disponible" : "No disponible"}
                            </span>
                        </span>
                        <span className={styles.datos}>
                            {publicacion.calibre.nombreCalibre || "-"} · Cat. {publicacion.categoria.nombreCategoria || "-"} · {publicacion.presentacion.nombrePresentacion || "-"}
                        </span>
                    </span>
                </span>
                <span className={styles.contenedorPrecio}>
                    <span className="text-xl font-extrabold text-foreground">{publicacion.precio === null ? "Sin precio" : `$${publicacion.precio}`}</span>
                    <span className={styles.botonDetalle} aria-hidden="true">›</span>
                </span>
            </span>
        </button>
    );
}
