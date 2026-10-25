import ImagenPublicacion from "../../../../../publicaciones/componentes/ImagenPublicacion";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import type { PublicacionPerfilProductor } from "@/modulos/usuarios/productores/acciones/consultas-perfil-por-operador";
import styles from "./TarjetaPublicacion.module.css";

const formatoPrecio = new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

type TarjetaPublicacionProps = {
    publicacion: PublicacionPerfilProductor;
    onSeleccionar?: (publicacion: PublicacionPerfilProductor) => void;
};

export default function TarjetaPublicacion({publicacion, onSeleccionar}: TarjetaPublicacionProps) {
    const nombreProducto = publicacion.variedad && publicacion.variedad !== "-" ? `${publicacion.especie} - ${publicacion.variedad}` : publicacion.especie;

    const contenido = (
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
                            <span className={styles.precio}>{formatoPrecio.format(Number(publicacion.precio))}</span>
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
    return contenido;
}
