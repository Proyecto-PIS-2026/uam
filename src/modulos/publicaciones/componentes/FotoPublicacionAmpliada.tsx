"use client";

import type { ReactNode } from "react";
import Dialog from "@mui/material/Dialog";
import CloseIcon from "@mui/icons-material/Close";
import ImagenPublicacion from "./ImagenPublicacion";
import styles from "./FotoPublicacionAmpliada.module.css";

type Props = {
    abierta: boolean;
    alCerrar: () => void;
    src: string | null | undefined;
    nombre: string;
    reemplazo: ReactNode;
};

export default function FotoPublicacionAmpliada({ abierta, alCerrar, src, nombre, reemplazo }: Props) {
    return <Dialog open={abierta} onClose={alCerrar} maxWidth={false} fullWidth aria-label="Foto ampliada del producto"
        slotProps={{ paper: { className: styles.modalFoto, "aria-label": "Foto ampliada del producto" }, backdrop: { sx: { backgroundColor: "rgba(0, 0, 0, 0.85)" } } }}>
        <button type="button" aria-label="Cerrar foto ampliada" onClick={alCerrar} className={styles.cerrarFoto}>
            <CloseIcon fontSize="small" />
        </button>
        <div className={styles.fotoAmpliada}>
            <ImagenPublicacion src={src} alt={`Foto ampliada de ${nombre}`} fill sizes="100vw" unoptimized className={styles.imagenAmpliada} reemplazo={reemplazo} />
        </div>
    </Dialog>;
}
