"use client";

import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import TextoAjustable from "./TextoAjustable";
import styles from "./DrawerPublicacionPerfil.module.css";
import Dialog from "@mui/material/Dialog";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import Image from "next/image";

interface DrawerPublicacionPerfilProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    publicacion: PublicacionPerfil | null;
    whatsAppOperador: string;
}

export default function DrawerPublicacionPerfil({publicacion, open, onOpenChange, whatsAppOperador}: DrawerPublicacionPerfilProps) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const numeroWhatsApp = whatsAppOperador.replace(/\D/g, "");
    const nombreProducto = publicacion ? publicacion.variedad !== "-" ? `${publicacion.especie} - ${publicacion.variedad}` : publicacion.especie : "";
    const mensajeWhatsApp = publicacion ? `Hola, vi tu publicación de ${nombreProducto} en Mercado UAM y quisiera hacerte una consulta.` : "";
    const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensajeWhatsApp)}`;

    const contenido = (
        <>
            {publicacion && (
                <div className={styles.tarjeta}>
                    <header className={styles.cabeceraDialogo}>
                        <h2 id="titulo-detalle-publicacion" className={styles.tituloDialogo}>Detalle de publicación</h2>
                        <button type="button" className={styles.cerrarDialogo} onClick={() => onOpenChange(false)} aria-label="Cerrar detalle de publicación">
                            <CloseIcon fontSize="small" aria-hidden="true" />
                        </button>
                    </header>
                    <div className={styles.indicador} />

                    <div className={styles.bloqueSuperior}>
                        <div className={styles.contenedorImagen}>
                            {publicacion.foto ? (
                                <Image src={publicacion.foto} alt={`Foto de ${publicacion.especie}`} fill sizes="(max-width: 767px) 160px, 256px" className={styles.imagen} />
                            ) : (
                                <div className={styles.sinFoto}>
                                    <ImageOutlinedIcon className={styles.iconoFoto} />
                                    Foto
                                </div>
                            )}
                        </div>

                        <div className={styles.bloqueSuperiorDerecho}>
                            <div className={styles.nombrePublicacion}>
                                <TextoAjustable texto={publicacion.especie} className={styles.especie} minimo={10} maximo={30} />
                                {publicacion.variedad !== "-" && <TextoAjustable texto={publicacion.variedad} className={styles.variedad} minimo={10} maximo={23} />}
                            </div>

                            <div className={styles.precio}>
                                {publicacion.precio != null ? `$${Number(publicacion.precio).toString()}` : "Sin precio"}
                            </div>
                        </div>
                    </div>

                    <div className={styles.bloqueMedio}>
                        <div className={styles.informacionDetallada}>
                            <span className={styles.nombreInformacion}>Presentación</span>
                            <span className={styles.valorInformacion}>{publicacion.presentacion}</span>
                        </div>

                        <div className={styles.informacionDetallada}>
                            <span className={styles.nombreInformacion}>Calibre</span>
                            <span className={styles.valorInformacion}>{publicacion.calibre}</span>
                        </div>

                        <div className={styles.informacionDetallada}>
                            <span className={styles.nombreInformacion}>Categoría</span>
                            <span className={styles.valorInformacion}>{publicacion.categoria}</span>
                        </div>
                    </div>

                    <div className={styles.bloqueBotones}>
                        <a href={enlaceWhatsApp} target="_blank" rel="noopener noreferrer" className={styles.botonWhatsApp} aria-label={`Consultar por ${nombreProducto} por WhatsApp`}>
                            <WhatsAppIcon className={styles.iconoWhatsApp} aria-hidden="true" />
                            WhatsApp
                        </a>
                    </div>
                </div>
            )}
        </>
    );

    if (esWeb) {
        return (
            <Dialog open={open} onClose={() => onOpenChange(false)} maxWidth={false} aria-labelledby="titulo-detalle-publicacion" slotProps={{ paper: { className: styles.drawer } }}>
                {contenido}
            </Dialog>
        );
    }

    return (
        <SwipeableDrawer anchor="bottom" open={open} onClose={() => onOpenChange(false)} onOpen={() => onOpenChange(true)} slotProps={{ paper: { className: styles.drawer } }} transitionDuration={{ enter: 400, exit: 400 }}>
            {contenido}
        </SwipeableDrawer>
    );
}
