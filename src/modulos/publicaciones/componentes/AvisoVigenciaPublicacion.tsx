import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import type { EstadoVigenciaPublicacion } from "../vigencia/estado-vigencia-publicacion";
import styles from "./AvisoVigenciaFoto.module.css";

type Props = { estado?: EstadoVigenciaPublicacion; fechaVigencia?: string | null };

export function DescripcionVigenciaPublicacion({ estado, id }: Pick<Props, "estado"> & { id: string }) {
    if (!estado) return null;
    return <span id={id} className="sr-only">{estado === "por-vencer" ? "Publicación por vencer" : "Publicación vencida"}</span>;
}

export function AvisoVigenciaPublicacion({ estado, fechaVigencia }: Props) {
    if (!estado || !fechaVigencia) return null;
    const [anio, mes, dia] = fechaVigencia.slice(0, 10).split("-");
    const fecha = `${dia}/${mes}/${anio}`;
    return <div role="status" className={`${styles.aviso} ${estado === "por-vencer" ? styles.advertencia : styles.peligro}`}>
        <WarningAmberRoundedIcon aria-hidden="true" />
        <p>{estado === "por-vencer"
            ? `Esta publicación vence el ${fecha}. Podés actualizar su fecha de vigencia.`
            : `Esta publicación venció el ${fecha} y ya no está disponible.`}</p>
    </div>;
}
