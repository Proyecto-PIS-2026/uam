import ImagenPublicacion from "../ImagenPublicacion";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import type { PublicacionListado } from "../../../consulta-mercado/acciones/PublicacionesOperador";
import styles from "./TarjetaPublicacionConOperador.module.css";

const formatoPrecio = new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
});

type TarjetaPublicacionProps = {
    publicacion: PublicacionListado;
    onClick: () => void;
};

export default function TarjetaPublicacionConOperador({publicacion, onClick}: TarjetaPublicacionProps) {
    const nombreProducto = publicacion.variedad && publicacion.variedad !== "-" ? `${publicacion.especie} - ${publicacion.variedad}` : publicacion.especie;
    const nombreOperador = publicacion.operador.nombreFantasia;

    return (
        <button type="button" className={styles.tarjeta} onClick={onClick} aria-label={`Ver detalles de ${nombreProducto}`}>
            <div className={styles.contenedorImagen}>
                <ImagenPublicacion src={publicacion.foto} alt={`Foto de ${nombreProducto}`} fill loading="lazy" sizes="(max-width: 419px) 72px, (max-width: 700px) 96px, (max-width: 774.4px) calc(50vw - 24px), (max-width: 1027.2px) calc(33.333vw - 21.333px), (max-width: 1279px) calc(25vw - 20px), 234px" className={styles.imagen} reemplazo={
                    <div className={styles.sinFoto}>
                        <ImageOutlinedIcon className={styles.iconoFoto} />
                        <span className={styles.textoSinFotoMobile}>
                            Foto
                        </span>
                        <span className={styles.textoSinFotoWeb}>
                            Sin foto disponible
                        </span>
                    </div>
                } />
            </div>
            <div className={styles.contenido}>
                <div className={styles.encabezado}>
                    <h3 className={styles.especie} title={nombreProducto}>
                        {nombreProducto}
                    </h3>
                    {/* Operador visible en mobile */}
                    <p className={styles.operadorMobile} title={nombreOperador}>
                        {nombreOperador}
                    </p>
                    <p className={styles.informacionWeb}>
                        <span className={styles.calibreCompleto}>
                            {publicacion.calibre}
                        </span>
                        <span className={styles.codigoCalibre}>
                            {publicacion.codigoCalibre}
                        </span>
                        {" · Categoría "}
                        {publicacion.categoria}
                    </p>
                </div>
                <div className={styles.cuerpo}>
                    <div className={styles.informacionMobile}>
                        <div className={styles.dato}>
                            <span className={styles.etiqueta}>
                                Calibre
                            </span>
                            <span className={styles.chip}>
                                <span className={styles.calibreCompleto}>
                                    {publicacion.calibre}
                                </span>
                                <span className={styles.codigoCalibre}>
                                    {publicacion.codigoCalibre}
                                </span>
                            </span>
                        </div>
                        <div className={styles.dato}>
                            <span className={styles.etiqueta}>
                                Cat.
                            </span>
                            <span className={styles.chip}>
                                {publicacion.categoria}
                            </span>
                        </div>
                    </div>
                    <div className={styles.filaInferior}>
                        {/* Operador visible en desktop */}
                        <p className={styles.operadorDesktop} title={nombreOperador}>
                            {nombreOperador}
                        </p>
                        <div className={styles.contenedorPrecio}>
                            {publicacion.precio == null ? (
                                <span className={styles.consultarPrecio}>
                                    Consultar precio
                                </span>
                            ) : (
                                <span className={styles.precio}>
                                    {formatoPrecio.format(publicacion.precio)}
                                </span>
                            )}
                            <span className={styles.presentacionPrecio} title={`por ${publicacion.presentacion}`}>
                                por {publicacion.presentacion}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </button>
    );
}
