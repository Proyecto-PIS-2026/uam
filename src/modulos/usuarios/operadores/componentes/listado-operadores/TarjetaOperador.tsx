import Image from "next/image";
import Link from "next/link";
import type { OperadorListado } from "../../consultas-listado-publico";
import styles from "./TarjetaOperador.module.css";

type TarjetaOperadorProps = {
    operador: OperadorListado;
};

export default function TarjetaOperador({ operador }: TarjetaOperadorProps) {
    const localesTexto = operador.locales.map((local) => `Nave ${local.nombreNave} - ${local.numeroLocal}`).join(" | ");
    const foto = operador.fotoPerfil?.trim();
    const inicial = operador.nombreFantasia.trim().charAt(0).toLocaleUpperCase("es");

    const contenido = (
        <Link href={`/operadores/${operador.id}`} className={styles.tarjeta}>
            <div className={styles.imagen}>
                {foto ? (
                    <Image src={foto} alt={`Foto de ${operador.nombreFantasia}`} fill sizes="(max-width: 767px) 64px, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 234px" className={styles.foto} />
                ) : (
                    <span className={styles.inicial}>{inicial}</span>
                )}
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
