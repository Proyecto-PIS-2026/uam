import ImagenPerfil from "@/modulos/usuarios/componentes/ImagenPerfil";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import Link from "next/link";
import type { ProductorListado } from "../../../acciones/consultas-listado-por-operador";
import styles from "./TarjetaProductor.module.css";

type TarjetaProductorProps = {
    productor: ProductorListado;
    puedeGestionar?: boolean;
};

export default function TarjetaProductor({ productor, puedeGestionar = false }: TarjetaProductorProps) {
    const foto = productor.fotoPerfil?.trim();
    const inicial = productor.nombreFantasia.trim().charAt(0).toLocaleUpperCase("es");
    const href = puedeGestionar
        ? `/gestion-productores/${productor.id}`
        : `/productores/${encodeURIComponent(productor.nombreFantasia)}?origen=productores`;

    const contenido = (
        <Link href={href} className={styles.tarjeta}>
            <div className={styles.imagen}>
                <ImagenPerfil src={foto} alt={`Foto de ${productor.nombreFantasia}`} fill sizes="(max-width: 767px) 64px, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 234px" className={styles.foto}
                    reemplazo={<span className={styles.inicial}>{inicial}</span>} />
            </div>

            <div className={styles.contenido}>
                <div className={styles.encabezado}>
                    <div className={styles.nombre} title={productor.nombreFantasia}>{productor.nombreFantasia}</div>
                    <p className={styles.departamentos}>
                        <LocationOnOutlinedIcon fontSize="small" aria-hidden="true" />
                        <span><span className="sr-only">Departamentos: </span>{productor.departamentos.join(" · ") || "-"}</span>
                    </p>
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
