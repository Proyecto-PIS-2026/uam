"use client";

import type { PublicacionListado } from "../../../consulta-mercado/acciones/Publicaciones";
import TextoAjustable from "./TextoAjustable";
import styles from "./DrawerDerechaPublicacion.module.css";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ImagenPublicacion from "../ImagenPublicacion";
import Link from "next/link";
// import HojasDecorativas from "../../../../compartido/HojasDecorativas";

interface DrawerPublicacionProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    publicacion: PublicacionListado | null;

}

export function DrawerDerechaPublicacion({ publicacion, open, onOpenChange }: DrawerPublicacionProps) {
    const numeroWhatsApp = publicacion?.operador.whatsApp.replace(/\D/g, "") ?? "";
    const mensajeWhatsApp = "Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.";
    const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensajeWhatsApp)}`;
    const fechaFormateada = publicacion ? new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Montevideo" }).format(new Date(publicacion.fecha)) : "";
    const contenido = (
        <SwipeableDrawer anchor="right" open={open && publicacion !== null} onClose={() => onOpenChange(false)} onOpen={() => { if (publicacion) onOpenChange(true); }} disableSwipeToOpen={publicacion === null} slotProps={{ paper: { className: styles.drawer, role: "dialog", "aria-label": "Detalle de publicación" } }} transitionDuration={{ enter: 400, exit: 400 }}>
            {publicacion && (
                <>
                    <div className={styles.tarjeta}>
                        {/* <HojasDecorativas variante="fondo" className={styles.hojasDrawer} /> */}
                        <div className={styles.bloqueSuperior}>
                            <div className={styles.marcoImagen}>
                                <div className={styles.contenedorImagen}>
                                    <ImagenPublicacion src={publicacion.foto} alt={`Foto de ${publicacion.especie}`} fill sizes="400px" className={styles.imagen} reemplazo={
                                        <div className={styles.sinFoto}>
                                            <ImageOutlinedIcon className={styles.iconoFoto} />
                                            Foto
                                        </div>
                                    } />
                                </div>
                            </div>
                            <div className={styles.bloqueSuperiorDerecho}>
                                <div className={styles.nombrePublicacion}>
                                    <TextoAjustable className={styles.especie} minimo={16} maximo={34}>{publicacion.especie}</TextoAjustable>
                                    {publicacion.variedad !== "-" &&
                                        <TextoAjustable className={styles.variedad} minimo={14} maximo={26}>{publicacion.variedad}</TextoAjustable>
                                    }
                                </div>
                                <div className={`${styles.precio} ${publicacion.precio == null ? styles.precioSinValor : ""}`}>
                                    {publicacion.precio != null ? <>${publicacion.precio}</> : "Consultar precio"}
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
                            <div className={styles.informacionDetallada}>
                                <span className={styles.nombreInformacion}>País</span>
                                <span className={styles.valorInformacion}>{publicacion.pais}</span>
                            </div>
                            <div className={styles.informacionDetallada}>
                                <span className={styles.nombreInformacion}>Actualización</span>
                                <time dateTime={publicacion.fecha} className={styles.valorInformacion}>{fechaFormateada}</time>
                            </div>
                        </div>
                        <div className={styles.bloqueInferior}>
                            <div className={styles.operador}><span className={styles.publicado}>Publicado por</span>{" "}<span className={styles.nombreOperador}>{publicacion.operador.nombreFantasia}</span></div>
                            <div className={styles.bloqueBotones}>
                                <Link href={`/operadores/${encodeURIComponent(publicacion.operador.nombreFantasia)}`} className={styles.botonPerfil} onClick={() => onOpenChange(false)}>Ver Perfil</Link>
                                <a href={enlaceWhatsApp} target="_blank" rel="noopener noreferrer" className={styles.botonWhatsApp} aria-label={`Contactar a ${publicacion.operador.nombreFantasia} por WhatsApp`}>
                                    <WhatsAppIcon className={styles.iconoWhatsApp} aria-hidden="true" />
                                    <span>WhatsApp</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </SwipeableDrawer>
    );
    return contenido;
}
