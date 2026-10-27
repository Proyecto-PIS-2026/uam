import ImagenPerfil from "@/modulos/usuarios/componentes/ImagenPerfil";
import Link from "next/link";
import type { OperadorListado } from "../../consultas-listado-publico";
import styles from "./TarjetaOperador.module.css";

type TarjetaOperadorProps = {
    operador: OperadorListado;
    puedeGestionar?: boolean;
};

export default function TarjetaOperador({ operador, puedeGestionar = false }: TarjetaOperadorProps) {
    const localesTexto = operador.locales.map((local) => {
        const nombreNave = local.nombreNave === "Tinglado" ? local.nombreNave : `Nave ${local.nombreNave}`;
        return `${nombreNave} - ${local.numeroLocal}`;
    }).join(" | ");
    const foto = operador.fotoPerfil?.trim();
    const inicial = operador.nombreFantasia.trim().charAt(0).toLocaleUpperCase("es");
    const href = puedeGestionar
        ? `/gestion-operadores/${operador.id}`
        : `/operadores/${encodeURIComponent(operador.nombreFantasia)}?origen=operadores`;

    const contenido = (
        <Link href={href} className={styles.tarjeta}>
            <div className={styles.imagen}>
                <ImagenPerfil src={foto} alt={`Foto de ${operador.nombreFantasia}`} fill sizes="(max-width: 700px) 64px, (max-width: 774.4px) calc(50vw - 24px), (max-width: 1027.2px) calc(33.333vw - 21.333px), (max-width: 1279px) calc(25vw - 20px), 234px" className={styles.foto} reemplazo={<span className={styles.inicial}>{inicial}</span>} />
            </div>

            <div className={styles.contenido}>
                <div className={styles.encabezado}>
                    <p className={styles.nombre} title={operador.nombreFantasia}>{operador.nombreFantasia}</p>
                    <span className={styles.separador}>|</span>
                    <p className={styles.locales} title={localesTexto}>{localesTexto}</p>
                </div>

                <div className={styles.pie}>
                    <span className={styles.cantidadProductos}>{operador.cantidadProductos}</span>
                    <span className={styles.textoProductos}>{operador.cantidadProductos === 1 ? "producto" : "productos"}</span>
                </div>
            </div>
        </Link>
    );

    return contenido;
}
