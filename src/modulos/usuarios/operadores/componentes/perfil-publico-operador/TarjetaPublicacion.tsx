import Image from "next/image";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import styles from "./TarjetaPublicacion.module.css";

const formatoPrecio = new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

type TarjetaPublicacionProps = {
    publicacion: PublicacionPerfil;
    onSeleccionar?: (publicacion: PublicacionPerfil) => void;
};

export default function TarjetaPublicacion({publicacion, onSeleccionar}: TarjetaPublicacionProps) {
    const nombreProducto = publicacion.variedad !== "-" ? `${publicacion.especie} - ${publicacion.variedad}` : publicacion.especie;

    return (
        <button type="button" className={styles.tarjeta} onClick={() => onSeleccionar?.(publicacion)} aria-label={`Ver detalles de ${nombreProducto}`} aria-haspopup="dialog">
            <div className={styles.contenedorImagen}>
                {publicacion.foto ? (
                    <Image src={publicacion.foto} alt={`Foto de ${nombreProducto}`} fill sizes="(max-width: 380px) 72px, (max-width: 767px) 96px, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 234px" className={styles.imagen}/>
                ) : (
                    <div className={styles.sinFoto}>
                        <ImageOutlinedIcon className={styles.iconoFoto}/>
                        <span className={styles.textoSinFotoMobile}>Foto</span>
                        <span className={styles.textoSinFotoWeb}>Sin foto disponible</span>
                    </div>
                )}
            </div>

            <div className={styles.contenido}>
                <div className={styles.encabezado}>
                    <h3 className={styles.especie} title={nombreProducto}>{nombreProducto}</h3>
                    <p className={styles.informacionWeb}>{publicacion.calibre} · Categoría {publicacion.categoria}</p>
                </div>
                <div className={styles.cuerpo}>
                    <div className={styles.informacionMobile}>
                        <div className={styles.dato}>
                            <span className={styles.etiqueta}>Calibre</span>
                            <span className={styles.chip}>{publicacion.calibre}</span>
                        </div>
                        <div className={styles.dato}>
                            <span className={styles.etiqueta}>Cat.</span>
                            <span className={styles.chip}>{publicacion.categoria}</span>
                        </div>
                    </div>
                    <div className={styles.contenedorPrecio}>
                        {publicacion.precio == null ? (
                            <span className={styles.precio}>{formatoPrecio.format(Number(publicacion.precio))}</span>
                        ) : (
                            <span className={styles.consultarPrecio}>Consultar precio</span>
                        )}
                        <span className={styles.presentacionPrecio}>por {publicacion.presentacion}</span>
                    </div>
                </div>
            </div>
        </button>
    );
}