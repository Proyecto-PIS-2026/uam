import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import type { EstadoFotoPublicacion } from "../estado-foto-publicacion";
import styles from "./AvisoVigenciaFoto.module.css";

type Props = { estado?: EstadoFotoPublicacion };

const textos = {
    "por-vencer": {
        titulo: "Foto por vencer",
        mensaje: "La foto está por vencer. Podés reemplazarla para renovar su vigencia.",
    },
    eliminada: {
        titulo: "Foto eliminada por vencimiento",
        mensaje: "La foto venció y fue eliminada. Podés cargar una nueva foto.",
    },
} as const;

function claseEstado(estado: NonNullable<EstadoFotoPublicacion>) {
    return estado === "por-vencer" ? styles.advertencia : styles.peligro;
}

export function IndicadorVigenciaFoto({ estado, id }: Props & { id: string }) {
    if (!estado) return null;
    return <span id={id} role="img" aria-label={textos[estado].titulo} title={textos[estado].titulo} className={`${styles.indicador} ${claseEstado(estado)}`}>
        <WarningAmberRoundedIcon aria-hidden="true" />
    </span>;
}

export function AvisoVigenciaFoto({ estado }: Props) {
    if (!estado) return null;
    return <div role="status" className={`${styles.aviso} ${claseEstado(estado)}`}>
        <WarningAmberRoundedIcon aria-hidden="true" />
        <p>{textos[estado].mensaje}</p>
    </div>;
}
