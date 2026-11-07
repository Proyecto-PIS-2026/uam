
"use client";

import BloqueEstadistica from "./BloqueEstadistica";
import type { EstadisticaVisitaItem, EstadisticaContactoItem, EstadisticaContactoPublicacionItem, EstadisticaPublicacionItem, EstadisticaCantidadPublicacionItem } from "./Tipos";
import styles from "./ContenedorEstadistica.module.css";

interface EstadisticasProps {
    datosIniciales: {
        visitas: EstadisticaVisitaItem[];
        contactos: EstadisticaContactoItem[];
        contactosPorPublicacion: EstadisticaContactoPublicacionItem[];
        publicaciones: EstadisticaPublicacionItem[];
        cantidadPublicaciones: EstadisticaCantidadPublicacionItem[];
    };
}

export default function ContenedorEstadistica({ datosIniciales }: EstadisticasProps) {
    return (
        <div className={styles.contenedorEstadisticas}>
            <div className={styles.panelContenedor}>
                <header className={styles.encabezadoSeccion}>
                    <h2>Panel Estadístico</h2>
                    <p>Visualiza el rendimiento de visitas, contactos de WhatsApp y publicaciones de la plataforma.</p>
                </header>
                <div className={styles.rejillaBloques}>
                    <BloqueEstadistica titulo="Visitas" tipo="visitas" datos={datosIniciales.visitas}/>
                    <BloqueEstadistica titulo="Contactos por el perfil" tipo="contactos" datos={datosIniciales.contactos}/>
                    <BloqueEstadistica titulo="Contactos por las publicaciones" tipo="contactosPorPublicacion" datos={datosIniciales.contactosPorPublicacion}/>
                    <BloqueEstadistica titulo="Publicaciones modificadas" tipo="publicaciones" datos={datosIniciales.publicaciones}/>
                    <BloqueEstadistica titulo="Cantidad de publicaciones" tipo="cantidadPublicaciones" datos={datosIniciales.cantidadPublicaciones}/>
                </div>
            </div>
        </div>
    );
}
