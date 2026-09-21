"use client";

import styles from "./DrawerPublicacion.module.css";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

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

export function DrawerPublicacion({ producto, open, onOpenChange}: DrawerPublicacionProps) {
    const contenido = (
        <SwipeableDrawer 
            anchor="bottom"
            open={open}
            onClose={() => onOpenChange(false)}
            onOpen={() => onOpenChange(true)}
            slotProps={{paper: { className: styles.drawer }}}
        >
            <div className={styles.indicador}/>

            <div className={styles.contenido}>
                <div className={styles.tarjeta}>
                    <div className={styles.bloque}> 
                        <div className={styles.imagen}>
                            {producto.foto !== null ? (
                                <img src={producto.foto}/>
                            ) : (
                                <span>IMG</span>
                            )
                            }
                        </div>
                        <div className={styles.informacion}>
                            <div className={styles.nombre}>
                                {producto.especie}
                                {" "}
                                {producto.variedad !== "-" && <>{producto.variedad}</>}
                            </div>
                            <div className={styles.precio}>
                                {producto.precio !== null ? <>$ {producto.precio}</> : "Sin precio"}
                            </div>
                        </div>
                    </div>
                    <div className={styles.bloque_2}> 
                        <div className={styles.etiquetas}>
                            <span className={styles.etiqueta}>
                                Presentacion {producto.presentacion}
                            </span>
                            <span className={styles.etiqueta}>
                                Calibre {producto.calibre}
                            </span>
                            <span className={styles.etiqueta}>
                                Categoria {producto.categoria}
                            </span>
                        </div>
                    </div>
                    <div className={styles.botones}>
                        <span className={styles.botonPerfil}>
                            Ver perfil
                        </span>
                        <span className={styles.botonWhatsApp}>
                            <WhatsAppIcon sx={{ fontSize: "1.20rem" }} />
                            {" "}
                            WhatsApp
                        </span>
                    </div>
                </div>
            </div>
        </SwipeableDrawer>
    );
    return contenido; 
}