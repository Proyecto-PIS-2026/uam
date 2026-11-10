import ImagenPerfil from "@/modulos/usuarios/componentes/ImagenPerfil";
import { obtenerIniciales } from "@/modulos/usuarios/obtener-iniciales";
import Link from "next/link";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
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
    const iniciales = obtenerIniciales(operador.nombreFantasia);
    const href = puedeGestionar
        ? `/gestion-operadores/${operador.id}`
        : `/operadores/${encodeURIComponent(operador.nombreFantasia)}?origen=operadores`;

    const contenido = (
        <Link href={href} className={styles.tarjeta}>
            <div className={styles.imagen}>
                <ImagenPerfil src={foto} alt={`Foto de ${operador.nombreFantasia}`} fill sizes="(max-width: 700px) 64px, (max-width: 774.4px) calc(50vw - 24px), (max-width: 1027.2px) calc(33.333vw - 21.333px), (max-width: 1279px) calc(25vw - 20px), 234px" className={styles.foto} reemplazo={<span className={styles.inicial}>{iniciales}</span>} />
            </div>

            <div className={styles.contenido}>
                <div className={styles.encabezado}>
                    <div className={styles.identidad}>
                        <div className={styles.datosIdentidad}>
                            <p className={styles.nombre} title={operador.nombreFantasia}>{operador.nombreFantasia}</p>
                            <span className={styles.separador}>|</span>
                            <p className={styles.locales} title={localesTexto}>{localesTexto}</p>
                        </div>
                        {operador.enLicencia && (
                            <span className={`${styles.avisoLicencia} ${styles.avisoLicenciaMovil}`}>
                                <WarningAmberOutlinedIcon aria-hidden="true" fontSize="small" />
                                En Licencia
                            </span>
                        )}
                    </div>
                </div>

                <div className={`${styles.pie} ${!operador.enLicencia ? styles.pieSinLicencia : ""}`}>
                    {operador.enLicencia && (
                        <span className={styles.avisoLicencia}>
                            <WarningAmberOutlinedIcon aria-hidden="true" fontSize="small" />
                            En Licencia
                        </span>
                    )}
                    <span className={styles.resumenProductos}>
                        <span className={styles.cantidadProductos}>{operador.cantidadProductos}</span>
                        <span className={styles.textoProductos}>{operador.cantidadProductos === 1 ? "producto" : "productos"}</span>
                    </span>
                </div>
            </div>
        </Link>
    );

    return contenido;
}
