import Image from "next/image";
import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import styles from "./TarjetaPublicacion.module.css";

type TarjetaPublicacionProps = {
    publicacion: PublicacionPerfil;
};

export default function TarjetaPublicacion({ publicacion }: TarjetaPublicacionProps) {
    const nombreProducto = publicacion.variedad !== "-" ? `${publicacion.especie} - ${publicacion.variedad}` : publicacion.especie;

    const contenido = (
        <article className={styles.tarjeta}>
            <div className={styles.contenedorImagen}>
                {publicacion.foto ? (
                    <Image src={publicacion.foto} alt={`Foto de ${publicacion.especie}`} fill sizes="(max-width: 380px) 72px, (max-width: 419px) 88px, 96px" className={styles.imagen}/>
                ) : (
                    <div className={styles.sinFoto}>Foto</div>
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
                            <span className={styles.chip}>{publicacion.calibre}</span>
                        </div>

                        <div className={styles.dato}>
                            <span className={styles.etiqueta}>Cat.</span>
                            <span className={styles.chip}>{publicacion.categoria}</span>
                        </div>
                    </div>

                    <div className={styles.contenedorPrecio}>
                        {publicacion.precio != null ? (
                            <>
                                <span className={styles.precio}>${Number(publicacion.precio).toString()}</span>
                                <span className={styles.presentacionPrecio}>por {publicacion.presentacion}</span>
                            </>
                        ) : (
                            <span className={styles.presentacionPrecio}>Consultar precio</span>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );

    return contenido;
}