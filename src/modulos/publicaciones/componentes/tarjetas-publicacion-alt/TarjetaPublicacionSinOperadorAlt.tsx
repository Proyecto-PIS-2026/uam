import Image from "next/image";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";

import type { PublicacionListado } from "../../consulta-mercado/acciones/publicaciones";
import styles from "./TarjetaPublicacionSinOperadorAlt.module.css";

type TarjetaPublicacionProps = {
    publicacion: PublicacionListado;
};

export default function TarjetaPublicacionSinOperador({ publicacion }: TarjetaPublicacionProps) {
    const precioNumerico = Number(publicacion.precio);
    const nombreProducto = publicacion.variedad !== "-" ? `${publicacion.especie} - ${publicacion.variedad}` : publicacion.especie;

    const contenido = (
        <article className={styles.tarjeta}>
            <div className={styles.contenedorImagen}>
                {publicacion.foto ? (
                    <Image src={publicacion.foto} alt={`Foto de ${publicacion.especie}`} fill sizes="(max-width: 380px) 72px, (max-width: 419px) 88px, 96px" className={styles.imagen}/>
                ) : (
                    <div className={styles.sinFoto}>
                        <ImageOutlinedIcon className={styles.iconoFoto}/>
                        Foto
                    </div>
                )}
            </div>

            <div className={styles.contenido}>
                <div className={styles.encabezado}>
                    <p className={styles.especie} title={nombreProducto}>{nombreProducto}</p>
                </div>

                <div className={styles.cuerpo}>
                    <div className={styles.informacion}>
                        <div className={styles.dato}>
                            <span className={styles.etiqueta}>Calibre</span>
                            <span className={styles.chip}>{publicacion.codigoCalibre}</span>
                        </div>

                        <div className={styles.dato}>
                            <span className={styles.etiqueta}>Cat.</span>
                            <span className={styles.chip}>{publicacion.categoria}</span>
                        </div>
                    </div>

                    <div className={styles.contenedorPrecio}>
                        <span className={styles.precio}>${precioNumerico}</span>
                        <span className={styles.presentacionPrecio}>por {publicacion.presentacion}</span>
                    </div>
                </div>
            </div>
        </article>
    );

    return contenido;
}