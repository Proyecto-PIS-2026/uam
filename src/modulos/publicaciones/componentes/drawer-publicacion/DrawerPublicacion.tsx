"use client";

import type { PublicacionListado } from "../../../consulta-mercado/acciones/publicaciones";
import styles from "./DrawerPublicacion.module.css";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import Image from "next/image";


interface DrawerPublicacionProps {
    open: boolean; 
    onOpenChange: (open: boolean) => void; 
    publicacion: PublicacionListado;

} 

export function DrawerPublicacion({publicacion, open, onOpenChange}: DrawerPublicacionProps) {
    const contenido = (
        <SwipeableDrawer 
            anchor="bottom"
            open={open}
            onClose={() => onOpenChange(false)}
            onOpen={() => onOpenChange(true)}
            slotProps={{paper:{className: styles.drawer}}}
        >
            <div className={styles.indicador}/>
            <div className={styles.tarjeta}>
                <div  className={styles.bloque_superior}>
                    <div className={styles.imagen}> 
                        {publicacion.foto ? <Image src={publicacion.foto} alt={publicacion.especie}/>
                        : <span className={styles.sin_foto}>IMG</span>}
                    </div>
                    <div className={styles.bloque_superior_derecho}>
                        <div>
                            <div className={styles.especie}>{publicacion.especie}</div>
                            {publicacion.variedad !== "-" &&
                                <div className={styles.variedad}>{publicacion.variedad}</div>
                            }
                        </div>
                        <div className={styles.precio}>
                            {publicacion.precio ? <>${publicacion.precio}</> : "Sin precio"}
                        </div>
                    </div>
                </div>
                <div className={styles.bloque_medio}>
                    <div className={styles.informacion_detallada}> 
                        <div className={styles.nombre_informacion}>Presentacion</div>
                        <div className={styles.valor_informacion}>
                            <span className={styles.etiqueta}>{publicacion.presentacion}</span>
                        </div>
                    </div>
                    <div className={styles.informacion_detallada}> 
                        <div className={styles.nombre_informacion}>Calibre</div>
                        <div className={styles.valor_informacion}>
                            <span className={styles.etiqueta}>{publicacion.calibre}</span>
                        </div>
                    </div>
                    <div className={styles.informacion_detallada}> 
                        <div className={styles.nombre_informacion}>Categoria</div>
                        <div className={styles.valor_informacion}>
                            <span className={styles.etiqueta}>{publicacion.categoria}</span>
                        </div>
                    </div>
                </div>
                <div className={styles.botones}>
                    <button className={styles.botonWhatsApp}><WhatsAppIcon sx={{fontSize: "1.20rem"}}/> {" "} WhatsApp</button>
                </div>
                <div className={styles.bloque_inferior}>
                    <span>Publicado por</span>
                    <span className={styles.nombre_operador}>{publicacion.operador.nombreFantasia}</span>
                </div>
            </div>
        </SwipeableDrawer>
    );
    return contenido; 
}