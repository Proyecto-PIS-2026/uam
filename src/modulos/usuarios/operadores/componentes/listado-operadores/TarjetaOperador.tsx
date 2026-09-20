import Link from "next/link";
import type { OperadorListado } from "../../consultas-listado-publico";
import styles from "./TarjetaOperador.module.css";

type TarjetaOperadorProps = {
    operador: OperadorListado;
};

export default function TarjetaOperador({ operador }: TarjetaOperadorProps) {
    const localesTexto = operador.locales.map((local) => `Nave ${local.nombreNave} - ${local.numeroLocal}`).join(" | ");

    const contenido = (
        <Link href={`/operadores/${operador.id}`} className={styles.tarjeta}>
            <div className={styles.imagen}>{/* foto del operador */}</div>
            <div className={styles.contenido}>
                <div className={styles.encabezado}>
                    <p className={styles.nombre} title={operador.nombreFantasia}>{operador.nombreFantasia}</p>
                    <span className={styles.separador}>|</span>
                    <p className={styles.locales} title={localesTexto}>{localesTexto}</p>
                </div>
            </div>
        </Link>
    );

    return contenido;
}