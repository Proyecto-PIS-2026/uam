"use client";

import { formatearEmpaquetado } from "@/modulos/publicaciones/empaquetado-publicacion";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import { IndicadorVigenciaFoto } from "../../componentes/AvisoVigenciaFoto";
import type { PublicacionMiMercadoProductor } from "../consultas-mi-mercado-productor";
import styles from "./TarjetaPublicacion.module.css";

type Props = {
    publicacion: PublicacionMiMercadoProductor;
    alConsultar: () => void;
};

export default function TarjetaPublicacionProductor({ publicacion, alConsultar }: Props) {
    const variedad = publicacion.variedad?.nombreVariedad;
    const especie = publicacion.especie.nombreEspecie;
    const nombreProducto = variedad && variedad.trim() !== "" && variedad.trim() !== "-" ? `${especie} · ${variedad}` : especie;

    return (
        <button type="button" onClick={alConsultar} className={`${styles.tarjeta} ${styles.tarjetaConsulta}`} aria-label={`Ver detalle de ${nombreProducto}`} aria-describedby={publicacion.estadoFoto ? `vigencia-foto-productor-${publicacion.id}` : undefined}>
            <span className={styles.botonFoto}>
                <ImagenPublicacion src={publicacion.foto} alt={nombreProducto} fill sizes="(min-width: 768px) 320px, 128px" unoptimized className={styles.foto} reemplazo={<span className={styles.sinFoto}>Sin fotografía</span>} />
                <IndicadorVigenciaFoto estado={publicacion.estadoFoto} id={`vigencia-foto-productor-${publicacion.id}`} />
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
                            {publicacion.calibre?.nombreCalibre || "-"} · Cat. {publicacion.categoria?.nombreCategoria || "-"} · {formatearEmpaquetado(publicacion.envase?.nombreEnvase, publicacion.kilos?.valor) || "-"}
                        </span>
                    </span>
                </span>
                <span className={styles.contenedorPrecio}>
                    <span className={styles.precio}>{publicacion.precio === null ? "Sin precio" : `$${Number(publicacion.precio).toFixed(0)}`}</span>
                    <span className={styles.botonDetalle} aria-hidden="true"><ChevronRightIcon aria-hidden="true" fontSize="inherit" /></span>
                </span>
            </span>
        </button>
    );
}
