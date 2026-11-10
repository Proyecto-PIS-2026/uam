import { formatearEmpaquetado } from "@/modulos/publicaciones/empaquetado-publicacion";
import { formatearPrecio } from "@/compartido/formatear-precio";
import ImagenPublicacion from "../ImagenPublicacion";
import HideImageOutlinedIcon from "@mui/icons-material/HideImageOutlined";
import type { PublicacionProductorListado } from "../../../consulta-mercado/acciones/PublicacionesProductor";
import styles from "./TarjetaPublicacionSinOperador.module.css";

type TarjetaPublicacionSinProductorProps = {
    publicacion: PublicacionProductorListado;
    onClick: () => void;
};

export default function TarjetaPublicacionSinProductor({ publicacion, onClick }: TarjetaPublicacionSinProductorProps) {
    const empaquetado = formatearEmpaquetado(publicacion.envase, publicacion.kilos);
    const nombreProducto = publicacion.variedad && publicacion.variedad !== "-" ? `${publicacion.especie} - ${publicacion.variedad}` : publicacion.especie;
    return (
        <button type="button" className={styles.tarjeta} onClick={onClick} aria-label={`Ver detalles de ${nombreProducto}`}>
            <div className={styles.contenedorImagen}>
                <ImagenPublicacion src={publicacion.foto} alt={`Foto de ${nombreProducto}`} fill
                    sizes="(max-width: 380px) 72px, (max-width: 767px) 96px, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 234px"
                    className={styles.imagen}
                    reemplazo={
                        <div className={styles.sinFoto} role="img" aria-label="Sin foto disponible">
                            <HideImageOutlinedIcon className={styles.iconoFoto} aria-hidden="true" />
                            <span className={styles.textoSinFotoWeb}> Sin foto disponible </span>
                        </div>
                    }
                />
            </div>
            <div className={styles.contenido}>
                <div className={styles.encabezado}>
                    <h3 className={styles.especie} title={nombreProducto}> {nombreProducto} </h3>
                    <p className={styles.informacionWeb}>
                        <span className={styles.calibreCompleto}> {publicacion.calibre?.trim() || "-"} </span>
                        <span className={styles.codigoCalibre}> {publicacion.codigoCalibre?.trim() || "-"} </span>
                        {" · Categoría "}
                        {publicacion.categoria?.trim() || "-"}
                    </p>
                </div>
                <div className={styles.cuerpo}>
                    <div className={styles.informacionMobile}>
                        <div className={styles.dato}>
                            <span className={styles.etiqueta}> Calibre </span>
                            <span className={styles.chip}>
                                <span className={styles.calibreCompleto}> {publicacion.calibre?.trim() || "-"} </span>
                                <span className={styles.codigoCalibre}> {publicacion.codigoCalibre?.trim() || "-"} </span>
                            </span>
                        </div>
                        <div className={styles.dato}>
                            <span className={styles.etiqueta}> Cat. </span>
                            <span className={styles.chip}> {publicacion.categoria?.trim() || "-"} </span>
                        </div>
                    </div>
                    <div className={styles.contenedorPrecio}>
                        {publicacion.precio == null ? (
                            <span className={styles.consultarPrecio}> Consultar precio </span>
                        ) : (
                            <span className={styles.precio}> {formatearPrecio(publicacion.precio)} </span>
                        )}
                        {empaquetado && (
                            <span className={styles.presentacionPrecio} title={`por ${empaquetado}`}> por {empaquetado} </span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
}
