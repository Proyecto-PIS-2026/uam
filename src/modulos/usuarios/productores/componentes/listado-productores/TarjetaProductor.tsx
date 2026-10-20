import Image from "next/image";
import Link from "next/link";
import type { ProductorListado } from "../../acciones/consultas-listado-por-operador";
import styles from "./TarjetaProductor.module.css";

type TarjetaProductorProps = {
    productor: ProductorListado;
};

export default function TarjetaProductor({ productor }: TarjetaProductorProps) {
    const foto = productor.fotoPerfil?.trim();
    const inicial = productor.nombreFantasia.trim().charAt(0).toLocaleUpperCase("es");

    const contenido = (
        <Link href={`/productores/${encodeURIComponent(productor.nombreFantasia)}`} className={styles.tarjeta}>
            <div className={styles.imagen}>
                {foto ? (
                    <Image src={foto} alt={`Foto de ${productor.nombreFantasia}`} fill sizes="(max-width: 767px) 64px, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 234px" className={styles.foto} />
                ) : (
                    <span className={styles.inicial}>{inicial}</span>
                )}
            </div>

            <div className={styles.contenido}>
                <div className={styles.encabezado}>
                    <div className={styles.nombre} title={productor.nombreFantasia}>{productor.nombreFantasia}</div>
                </div>
                <div className={styles.pie}>
                    <span className={styles.cantidadProductos}>{productor.cantidadProductos}</span>
                    <span className={styles.textoProductos}>{productor.cantidadProductos === 1 ? "producto" : "productos"}</span>
                </div>
            </div>
        </Link>
    );
    return contenido;
}
