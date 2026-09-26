"use client";

import type { PublicacionListado } from "../../../consulta-mercado/acciones/publicaciones";
import TextoAjustable from "./TextoAjustable";
import styles from "./DrawerDerechaPublicacion.module.css";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import Image from "next/image";

interface DrawerPublicacionProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    publicacion: PublicacionListado | null;

}

export function DrawerDerechaPublicacion({ publicacion, open, onOpenChange }: DrawerPublicacionProps) {
    const numeroWhatsApp = publicacion?.operador.whatsApp.replace(/\D/g, "") ?? "";
    const mensajeWhatsApp = "Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.";
    const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensajeWhatsApp)}`;
    const contenido = (
        <SwipeableDrawer anchor="right" open={open} onClose={() => onOpenChange(false)} onOpen={() => onOpenChange(true)} slotProps={{ paper: { className: styles.drawer } }} transitionDuration={{ enter: 400, exit: 400 }}>
            {publicacion && (
                <>
                    <div className={styles.tarjeta}>
                        <div className={styles.bloqueSuperior}>
                            <div className={styles.contenedorImagen}>
                                {publicacion.foto ? (
                                    <Image src={publicacion.foto} alt={`Foto de ${publicacion.especie}`} fill sizes="(max-width: 380px) 72px, (max-width: 419px) 88px, 96px" className={styles.imagen} />
                                ) : (
                                    <div className={styles.sinFoto}>
                                        <ImageOutlinedIcon className={styles.iconoFoto} />
                                        Foto
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className={styles.bloqueSuperiorDerecho}>
                            <div className={styles.nombrePublicacion}>
                                <TextoAjustable className={styles.especie} minimo={10} maximo={40}>{publicacion.especie}</TextoAjustable>
                                {publicacion.variedad !== "-" &&
                                    <TextoAjustable className={styles.variedad} minimo={10} maximo={30}>{publicacion.variedad}</TextoAjustable>
                                }
                            </div>
                            <div className={styles.precio}>
                                {publicacion.precio ? <>${publicacion.precio}</> : "Sin precio"}
                            </div>
                            <div className={styles.bloqueMedio}>
                                <div className={styles.informacionDetallada}>
                                    <span className={styles.nombreInformacion}>Presentacion</span>
                                    <span className={styles.valorInformacion}>{publicacion.presentacion}</span>
                                </div>
                                <div className={styles.informacionDetallada}>
                                    <span className={styles.nombreInformacion}>Calibre</span>
                                    <span className={styles.valorInformacion}>{publicacion.calibre}</span>
                                </div>
                                <div className={styles.informacionDetallada}>
                                    <span className={styles.nombreInformacion}>Categoria</span>
                                    <span className={styles.valorInformacion}>{publicacion.categoria}</span>
                                </div>
                            </div>
                            <div className={styles.bloqueInferior}>
                                <TextoAjustable className={styles.operador} minimo={12} maximo={16}><span className={styles.publicado}>Publicado por</span>{" "}<span className={styles.nombreOperador}>{publicacion.operador.nombreFantasia}</span></TextoAjustable>
                                <div className={styles.bloqueBotones}>
                                    <button className={styles.botonPerfil}>Ver Perfil</button>
                                    <a href={enlaceWhatsApp} target="_blank" rel="noopener noreferrer" className={styles.botonWhatsApp} aria-label={`Contactar a ${publicacion.operador.nombreFantasia} por WhatsApp`}>
                                        <WhatsAppIcon className={styles.iconoWhatsApp} aria-hidden="true" />
                                        <span>WhatsApp</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </SwipeableDrawer>
    );
    return contenido;
}