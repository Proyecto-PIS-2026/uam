"use client";

import type { PublicacionPerfilAdmin } from "../../consultas-perfil-admin";
import TextoAjustable from "../../../../publicaciones/componentes/drawer-publicacion/TextoAjustable";
import styles from "./DrawerPublicacionAdmin.module.css";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import ImagenPublicacion from "../../../../publicaciones/componentes/ImagenPublicacion";

interface DrawerPublicacionAdminProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    publicacion: PublicacionPerfilAdmin | null;
}

// Copia de DrawerPublicacionPerfil adaptada al administrador:
// sin contacto por Whatsapp, con estado de disponibilidad y código del calibre
export default function DrawerPublicacionAdmin({publicacion, open, onOpenChange }: DrawerPublicacionAdminProps) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const contenido = (
        <>
            {publicacion && (
                <div className={styles.tarjeta}>
                    <div className={styles.indicador} />

                    <div className={styles.bloqueSuperior}>
                        <div className={styles.marcoImagen}>
                            <div className={styles.contenedorImagen}>
                                <ImagenPublicacion src={publicacion.foto} alt={`Foto de ${publicacion.especie}`} fill sizes="(max-width: 767px) 160px, 400px" className={styles.imagen} reemplazo={
                                    <div className={styles.sinFoto}>
                                        <ImageOutlinedIcon className={styles.iconoFoto} />
                                        Foto
                                    </div>
                                } />
                            </div>
                        </div>

                        <div className={styles.bloqueSuperiorDerecho}>
                            <div className={styles.nombrePublicacion}>
                                <TextoAjustable className={styles.especie} minimo={esWeb ? 16 : 10} maximo={esWeb ? 34 : 30}>
                                    {publicacion.especie}
                                </TextoAjustable>
                                {publicacion.variedad !== "-" && (
                                    <TextoAjustable className={styles.variedad} minimo={esWeb ? 14 : 10} maximo={esWeb ? 26 : 23}>
                                        {publicacion.variedad}
                                    </TextoAjustable>
                                )}
                            </div>

                            <div className={`${styles.precio} ${publicacion.precio == null ? styles.consultarPrecio : ""}`}>
                                {publicacion.precio != null ? `$${Number(publicacion.precio).toString()}` : "Sin precio"}
                            </div>

                            <span className={`${styles.estado} ${publicacion.disponible ? styles.estadoDisponible : styles.estadoNoDisponible}`}>
                                {publicacion.disponible ? "Disponible" : "No disponible"}
                            </span>
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
                    </div>
                </div>
            )}
        </>
    );

    return (
        <SwipeableDrawer anchor={esWeb ? "right" : "bottom"} open={open && publicacion !== null} onClose={() => onOpenChange(false)} onOpen={() => { if (publicacion) onOpenChange(true); }} disableSwipeToOpen={publicacion === null} slotProps={{ paper: { className: styles.drawer, role: "dialog", "aria-label": "Detalle de publicación" } }} transitionDuration={{ enter: 400, exit: 400 }}>
            {contenido}
        </SwipeableDrawer>
    );
}
