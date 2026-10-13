import ImagenPublicacion from "../../../../publicaciones/componentes/ImagenPublicacion";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import type { PublicacionPerfilAdmin } from "../../consultas-perfil-admin";
import styles from "./TarjetaPublicacionAdmin.module.css";

const formatoPrecio = new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

type TarjetaPublicacionAdminProps = {
    publicacion: PublicacionPerfilAdmin;
    onSeleccionar?: (publicacion: PublicacionPerfilAdmin) => void;
};

// Copia de TarjetaPublicacion (perfil público) adaptada al administrador
export default function TarjetaPublicacionAdmin({publicacion, onSeleccionar }: TarjetaPublicacionAdminProps) {
    const nombreProducto = publicacion.variedad !== "-" ? `${publicacion.especie} - ${publicacion.variedad}` : publicacion.especie;

    return (
        <button type="button" className={styles.tarjeta} onClick={() => onSeleccionar?.(publicacion)} aria-label={`Ver detalles de ${nombreProducto}`} aria-haspopup="dialog">
            <div className={styles.contenedorImagen}>
                <ImagenPublicacion src={publicacion.foto} alt={`Foto de ${nombreProducto}`} fill sizes="(max-width: 380px) 72px, (max-width: 767px) 96px, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 234px" className={styles.imagen} reemplazo={
                    <div className={styles.sinFoto}>
                        <ImageOutlinedIcon className={styles.iconoFoto}/>
                        <span className={styles.textoSinFotoMobile}>Foto</span>
                        <span className={styles.textoSinFotoWeb}>Sin foto disponible</span>
                    </div>
                } />
            </div>

            <div className={styles.contenido}>
                <div className={styles.encabezado}>
                    <div className="flex w-full min-w-0 items-start justify-between gap-2">
                        <h3 className={`${styles.especie} min-w-0 flex-1`} title={nombreProducto}>{nombreProducto}</h3>
                        <span
                            className={`
                                shrink-0 rounded-full
                                px-2 py-0.5
                                text-[10px] font-bold
                                ${
                                    publicacion.disponible
                                        ? "bg-primary-soft text-secondary"
                                        : "bg-gray-100 text-muted"
                                }
                            `}
                        >
                            {publicacion.disponible
                                ? "Disponible"
                                : "No disponible"}
                        </span>
                    </div>
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
                        {publicacion.precio != null ? (
                            <span className={styles.precio}>{formatoPrecio.format(Number(publicacion.precio))}</span>
                        ) : (
                            <span className={styles.consultarPrecio}>Sin precio</span>
                        )}
                        <span className={styles.presentacionPrecio}>por {publicacion.presentacion}</span>
                    </div>
                </div>
            </div>
        </button>
    );
}
