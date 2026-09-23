"use client";

import styles from "./DrawerPublicacion.module.css";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import Image from "next/image";
import { Button } from "@mui/material";

export type DetallePublicacion = {
    id: number; 
    precio: number; 
    foto: string | null; 
    especie: string; 
    variedad: string; 
    presentacion: string; 
    categoria: string; 
    calibre: string; 
    codigoCalibre: string; 
    pais: string; 
    operador: {
        id: number; 
        nombreFantasia: string; 
        fotoPerfil: string | null; 
        whatsApp: string; 
    }
}

interface DrawerPublicacionProps {
    open: boolean; 
    onOpenChange: (open: boolean) => void; 
    producto: DetallePublicacion; 

} 

export function DrawerPublicacion({producto, open, onOpenChange}: DrawerPublicacionProps) {
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
                        {producto.foto ? <Image src={producto.foto} alt={producto.especie}/>
                        : <span className={styles.sin_foto}>IMG</span>}
                    </div>
                    <div className={styles.bloque_superior_derecho}>
                        <div>
                            <div className={styles.especie}>{producto.especie}</div>
                            {producto.variedad !== "-" &&
                                <div className={styles.variedad}>{producto.variedad}</div>
                            }
                        </div>
                        <div className={styles.precio}>
                            {producto.precio ? <>${producto.precio}</> : "Sin precio"}
                        </div>
                    </div>
                </div>
                <div className={styles.bloque_medio}>
                    <div className={styles.informacion_detallada}> 
                        <div className={styles.nombre_informacion}>Presentacion</div>
                        <div className={styles.valor_informacion}>
                            <span className={styles.etiqueta}>{producto.presentacion}</span>
                        </div>
                    </div>
                    <div className={styles.informacion_detallada}> 
                        <div className={styles.nombre_informacion}>Calibre</div>
                        <div className={styles.valor_informacion}>
                            <span className={styles.etiqueta}>{producto.calibre}</span>
                        </div>
                    </div>
                    <div className={styles.informacion_detallada}> 
                        <div className={styles.nombre_informacion}>Categoria</div>
                        <div className={styles.valor_informacion}>
                            <span className={styles.etiqueta}>{producto.categoria}</span>
                        </div>
                    </div>
                </div>
                <div className={styles.botones}>
                    <button className={styles.botonWhatsApp}><WhatsAppIcon sx={{fontSize: "1.20rem"}}/> {" "} WhatsApp</button>
                </div>
                <div className={styles.bloque_inferior}>
                    <span>Publicado por</span>
                    <span className={styles.nombre_operador}>{producto.operador.nombreFantasia}</span>
                </div>
            </div>
        </SwipeableDrawer>
    );
    return contenido; 
}