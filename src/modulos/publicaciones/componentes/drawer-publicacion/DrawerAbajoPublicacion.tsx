"use client";

import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ImagenPublicacion from "../ImagenPublicacion";
import Link from "next/link";
import Dialog from "@mui/material/Dialog";
import CloseIcon from "@mui/icons-material/Close";

import type { PublicacionListado } from "../../../consulta-mercado/acciones/Publicaciones";
import type { PublicacionProductorListado } from "../../../consulta-mercado/acciones/PublicacionesProductor";
import TextoAjustable from "./TextoAjustable";
import UbicacionesRetiro from "./UbicacionesRetiro";
import styles from "./DrawerAbajoPublicacion.module.css";

import { useEffect, useRef, useState } from "react";

interface DrawerPublicacionProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    publicacion: PublicacionListado | PublicacionProductorListado | null;
}

export function DrawerAbajoPublicacion({ publicacion, open, onOpenChange }: DrawerPublicacionProps) {
    const usuario = publicacion ? "productor" in publicacion ? publicacion.productor : publicacion.operador : null;
    const numeroWhatsApp = usuario?.whatsApp.replace(/\D/g, "") ?? "";
    const mensajeWhatsApp = "Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.";
    const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensajeWhatsApp)}`;
    const enlacePerfil = publicacion && usuario ? `/${"productor" in publicacion ? "productores" : "operadores"}/${encodeURIComponent(usuario.nombreFantasia)}` : "";
    const fechaFormateada = publicacion ? new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Montevideo" }).format(new Date(publicacion.fecha)) : "";
    const [fotoAmpliada, setFotoAmpliada] = useState(false);
    const contenidoRef = useRef<HTMLDivElement>(null);
    const [necesitaScroll, setNecesitaScroll] = useState(false);
    const [fotoPreparada, setFotoPreparada] = useState<string | null>(null);
    const claveFoto = publicacion ? `${publicacion.id}-${publicacion.foto ?? ""}` : "";
    const tieneFoto = Boolean(publicacion?.foto?.trim());
    const drawerVisible = open && publicacion !== null && (!tieneFoto || fotoPreparada === claveFoto);
    
    useEffect(() => {
        if (drawerVisible && contenidoRef.current) {
            contenidoRef.current.scrollTop = 0;
        }
    }, [drawerVisible, publicacion?.id]);
    
    useEffect(() => {
        const contenido = contenidoRef.current;
        if (!contenido || !drawerVisible) {
            return;
        }
        const comprobarScroll = () => {setNecesitaScroll(contenido.scrollHeight > contenido.clientHeight + 1,)};
        const observer = new ResizeObserver(comprobarScroll);
        observer.observe(contenido);
        for (const hijo of contenido.children) {
            observer.observe(hijo);
        }
        comprobarScroll();
        return () => observer.disconnect();
    }, [drawerVisible, publicacion]);

    const contenido = (
        <SwipeableDrawer anchor="bottom" open={drawerVisible} onClose={() => onOpenChange(false)} onOpen={() => { if (publicacion) onOpenChange(true); }} disableSwipeToOpen={publicacion === null} slotProps={{ paper: { className: styles.drawer, role: "dialog", "aria-label": "Detalle de publicación" } }} transitionDuration={{ enter: 400, exit: 400 }} ModalProps={{ keepMounted: true }}>
            {publicacion &&  usuario && (
                <>
                    <div className={styles.tarjeta}>
                        <div className={styles.encabezado}>
                            <div className={styles.titulo}>Detalle de publicación</div>
                            <button className={styles.cerrar} type="button" onClick={() => onOpenChange(false)} aria-label="Detalle de consulta">
                                <CloseIcon fontSize="small" />
                            </button>
                        </div>
                        <div ref={contenidoRef} className={styles.contenidoScrollable}>
                            <div className={styles.cabecera}>
                                <div className={styles.bloqueSuperior}>
                                    <div className={styles.marcoImagen}>
                                        <div className={styles.contenedorImagen}>
                                            <ImagenPublicacion key={claveFoto} src={publicacion.foto} alt={`Foto de ${publicacion.especie}`} loading="eager" onLoad={() => setFotoPreparada(claveFoto)} fill sizes="160px" className={styles.imagen} onError={() => setFotoPreparada(claveFoto)} reemplazo={
                                                <div className={styles.sinFoto}>
                                                    <ImageOutlinedIcon className={styles.iconoFoto} />
                                                    Foto
                                                </div>
                                            } />
                                            {publicacion.foto && (
                                                <button type="button" className={styles.ampliarFoto} aria-label={`Ampliar foto de ${publicacion.especie}`} onClick={() => setFotoAmpliada(true)}/>
                                            )}
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
                                <div className={styles.informacionDetallada}>
                                    <span className={styles.nombreInformacion}>Actualización</span>
                                    <time dateTime={publicacion.fecha} className={styles.valorInformacion}>{fechaFormateada}</time>
                                </div>
                            </div>
                            {"productor" in publicacion && (
                                <UbicacionesRetiro ubicaciones={publicacion.ubicaciones} />
                            )}
                        </div>
                        <div className={`${styles.pie} ${necesitaScroll ? styles.pieConScroll : ""}`}>
                            <div className={styles.operador}>
                                <span className={styles.publicado}>Publicado por</span>{" "}
                                <span className={styles.nombreOperador}>{usuario.nombreFantasia}</span>
                            </div>
                            <div className={styles.bloqueBotones}>
                                <Link href={enlacePerfil} className={styles.botonPerfil} onClick={() => onOpenChange(false)}>Ver Perfil</Link>
                                <a href={enlaceWhatsApp} target="_blank" rel="noopener noreferrer" className={styles.botonWhatsApp} aria-label={`Contactar a ${usuario.nombreFantasia} por WhatsApp`}>
                                    <WhatsAppIcon className={styles.iconoWhatsApp} aria-hidden="true" />
                                    <span>WhatsApp</span>
                                </a>
                            </div>
                        </div>
                    </div>
                    <Dialog open={fotoAmpliada && open && Boolean(publicacion?.foto)} onClose={() => setFotoAmpliada(false)} maxWidth={false} fullWidth aria-label="Foto ampliada del producto" slotProps={{ paper: { className: styles.modalFoto }, backdrop: { sx: { backgroundColor: "rgba(0, 0, 0, 0.85)" }  } }}>
                        <button aria-label="Cerrar foto ampliada" onClick={() => setFotoAmpliada(false)} className={`${styles.cerrar} ${styles.cerrarFoto}`}>
                            <CloseIcon fontSize="small" />
                        </button>
                        <div className={styles.fotoAmpliada}>
                            <ImagenPublicacion key={`${publicacion.id}-${publicacion.foto}`} src={publicacion?.foto ?? null} alt={`Foto ampliada de ${publicacion?.especie ?? ""}`} fill sizes="100vw" className={styles.imagenAmpliada}  reemplazo={
                                <div className={styles.sinFoto}>
                                    <ImageOutlinedIcon className={styles.iconoFoto} />
                                    Foto
                                </div>
                            } />
                        </div>
                    </Dialog>
                </>
            )}
        </SwipeableDrawer>
    );
    return contenido;
}