"use client";

import { useMemo } from "react";
import BloqueEstadistica from "./BloqueEstadistica";
import type { EstadisticaVisitaItem, EstadisticaContactoItem, EstadisticaPublicacionItem } from "./Tipos";
import styles from "./ContenedorEstadistica.module.css";
import BloqueEstadisticaComparativa from "./BloqueEstadisticaComparativa";

interface EstadisticasProps {
    datosIniciales: {
        visitas: EstadisticaVisitaItem[];
        contactos: EstadisticaContactoItem[];
        publicaciones: EstadisticaPublicacionItem[];
    };
}

export default function ContenedorEstadistica({ datosIniciales }: EstadisticasProps) {
    const opcionesComparativas = useMemo(() => {
        const usernames = new Set([
            ...datosIniciales.contactos.map((c) => c.username),
            ...datosIniciales.publicaciones.map((p) => p.username),
        ]);

        return Array.from(usernames).map((u) => ({ valor: u, etiqueta: u }));
    }, [datosIniciales.contactos, datosIniciales.publicaciones]);

    return (
        <div className={styles.contenedorEstadisticas}>
            <div className={styles.panelContenedor}>
                <header className={styles.encabezadoSeccion}>
                    <h2>Panel Estadístico</h2>
                    <p>
                        Visualiza el rendimiento de visitas, contactos de WhatsApp y publicaciones de la plataforma.
                    </p>
                </header>

                <div className={styles.rejillaBloques}>
                    {/* SECCION DE VISITAS */}
                    <BloqueEstadistica
                        titulo="Visitas"
                        tipo="visitas"
                        datos={datosIniciales.visitas}
                    />

                    {/* SECCION MIXTA */}
                    <BloqueEstadisticaComparativa
                        contactos={datosIniciales.contactos}
                        publicaciones={datosIniciales.publicaciones}
                        opcionesFiltroEspecifico={opcionesComparativas}
                    />
                </div>
            </div>
        </div>
    );
}