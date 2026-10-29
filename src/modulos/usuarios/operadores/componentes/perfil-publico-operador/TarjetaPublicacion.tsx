import { formatearPrecio } from "@/compartido/formatear-precio";
import ImagenPublicacion from "../../../../publicaciones/componentes/ImagenPublicacion";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import styles from "./TarjetaPublicacion.module.css";

type TarjetaPublicacionProps = {
    publicacion: PublicacionPerfil;
    onSeleccionar?: (publicacion: PublicacionPerfil) => void;
};

export default function TarjetaPublicacion({publicacion, onSeleccionar}: TarjetaPublicacionProps) {
    const nombreProducto = publicacion.variedad && publicacion.variedad !== "-" ? `${publicacion.especie} - ${publicacion.variedad}` : publicacion.especie;

    return (
        <button type="button" className={styles.tarjeta} onClick={() => onSeleccionar?.(publicacion)} aria-label={`Ver detalles de ${nombreProducto}`} aria-haspopup="dialog">
            <div className={styles.contenedorImagen}>
                <ImagenPublicacion src={publicacion.foto} alt={`Foto de ${nombreProducto}`} fill sizes="(max-width: 380px) 72px, (max-width: 419px) 88px, (max-width: 700px) 96px, (max-width: 774.4px) calc(50vw - 24px), (max-width: 1027.2px) calc(33.333vw - 21.333px), (max-width: 1279px) calc(25vw - 20px), 234px" className={styles.imagen} reemplazo={
                    <div className={styles.sinFoto}>
                        <ImageOutlinedIcon className={styles.iconoFoto}/>
                        <span className={styles.textoSinFotoMobile}>Foto</span>
                        <span className={styles.textoSinFotoWeb}>Sin foto disponible</span>
                    </div>
                } />
            </div>

            <div className={styles.contenido}>
                <div className={styles.encabezado}>
                    <h3 className={styles.especie} title={nombreProducto}>{nombreProducto}</h3>
                    <p className={styles.informacionWeb}>{publicacion.calibre?.trim() || "-"} · Categoría {publicacion.categoria?.trim() || "-"}</p>
                </div>
                <div className={styles.cuerpo}>
                    <div className={styles.informacionMobile}>
                        <div className={styles.dato}>
                            <span className={styles.etiqueta}>Calibre</span>
                            <span className={styles.chip}>{publicacion.calibre?.trim() || "-"}</span>
                        </div>
                        <div className={styles.dato}>
                            <span className={styles.etiqueta}>Cat.</span>
                            <span className={styles.chip}>{publicacion.categoria?.trim() || "-"}</span>
                        </div>
                    </div>
                    <div className={styles.contenedorPrecio}>
                        {publicacion.precio != null ? (
                            <span className={styles.precio}>{formatearPrecio(Number(publicacion.precio))}</span>
                        ) : (
                            <span className={styles.consultarPrecio}>Consultar precio</span>
                        )}
                        {publicacion.presentacion?.trim() && publicacion.presentacion.trim() !== "-" && (
                            <span className={styles.presentacionPrecio}>por {publicacion.presentacion.trim()}</span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
}
