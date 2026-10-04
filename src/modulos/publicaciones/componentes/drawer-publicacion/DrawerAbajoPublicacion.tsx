"use client";

import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ImagenPublicacion from "../ImagenPublicacion";
import Link from "next/link";
// import HojasDecorativas from "../../../../compartido/HojasDecorativas";

import type { PublicacionListado } from "../../../consulta-mercado/acciones/Publicaciones";
import TextoAjustable from "./TextoAjustable";
import styles from "./DrawerAbajoPublicacion.module.css";

interface DrawerPublicacionProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    publicacion: PublicacionListado | null;
}

export function DrawerAbajoPublicacion({ publicacion, open, onOpenChange }: DrawerPublicacionProps) {
    const numeroWhatsApp = publicacion?.operador.whatsApp.replace(/\D/g, "") ?? "";
    const mensajeWhatsApp = "Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.";
    const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensajeWhatsApp)}`;
    const contenido = (
        <SwipeableDrawer anchor="bottom" open={open && publicacion !== null} onClose={() => onOpenChange(false)} onOpen={() => { if (publicacion) onOpenChange(true); }} disableSwipeToOpen={publicacion === null} slotProps={{ paper: { className: styles.drawer, role: "dialog", "aria-label": "Detalle de publicación" } }} transitionDuration={{ enter: 400, exit: 400 }}>
            {publicacion && (
                <>
                    <div className={styles.tarjeta}>
                        {/* <HojasDecorativas variante="fondo" className={styles.hojasDrawer} /> */}
                        <div className={styles.indicador} />
                        <div className={styles.bloqueSuperior}>
                            <div className={styles.marcoImagen}>
                                <div className={styles.contenedorImagen}>
                                    <ImagenPublicacion src={publicacion.foto} alt={`Foto de ${publicacion.especie}`} fill sizes="160px" className={styles.imagen} reemplazo={
                                        <div className={styles.sinFoto}>
                                            <ImageOutlinedIcon className={styles.iconoFoto} />
                                            Foto
                                        </div>
                                    } />
                                </div>
                            </div>
                            <div className={styles.bloqueSuperiorDerecho}>
                                <div className={styles.nombrePublicacion}>
                                    <TextoAjustable className={styles.especie} minimo={10} maximo={30}>{publicacion.especie}</TextoAjustable>
                                    {publicacion.variedad !== "-" &&
                                        <TextoAjustable className={styles.variedad} minimo={10} maximo={23}>{publicacion.variedad}</TextoAjustable>
                                    }
                                </div>
                                <div className={`${styles.precio} ${publicacion.precio == null ? styles.consultarPrecio : ""}`}>
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
                                <span className={styles.nombreInformacion}>Unidades ({publicacion.presentacion})</span>
                                <span className={styles.valorInformacion}>{publicacion.cantidadUnidades === null ? "-" : publicacion.cantidadUnidades}</span>
                            </div>
                            <div className={styles.informacionDetallada}>
                                <span className={styles.nombreInformacion}>País</span>
                                <span className={styles.valorInformacion}>{publicacion.pais}</span>
                            </div>
                        </div>
                        <div className={styles.operador}>
                            <span className={styles.publicado}>Publicado por</span>{" "}
                            <span className={styles.nombreOperador}>{publicacion.operador.nombreFantasia}</span>
                        </div>
                        <div className={styles.bloqueBotones}>
                            <Link href={`/operadores/${encodeURIComponent(publicacion.operador.nombreFantasia)}`} className={styles.botonPerfil} onClick={() => onOpenChange(false)}>Ver Perfil</Link>
                            <a href={enlaceWhatsApp} target="_blank" rel="noopener noreferrer" className={styles.botonWhatsApp} aria-label={`Contactar a ${publicacion.operador.nombreFantasia} por WhatsApp`}>
                                <WhatsAppIcon className={styles.iconoWhatsApp} aria-hidden="true" />
                                <span>WhatsApp</span>
                            </a>
                        </div>
                    </div>
                </>
            )}
        </SwipeableDrawer>
    );
    return contenido;
}
