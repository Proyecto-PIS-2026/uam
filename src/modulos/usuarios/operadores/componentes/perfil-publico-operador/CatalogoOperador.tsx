"use client";

import { useState } from "react";
import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import DrawerPublicacionPerfil from "./DrawerPublicacionPerfil";
import TarjetaPublicacion from "./TarjetaPublicacion";
import styles from "./CatalogoOperador.module.css";

type CatalogoOperadorProps = {
    publicaciones: PublicacionPerfil[];
    whatsAppOperador?: string;
};

export default function CatalogoOperador({publicaciones, whatsAppOperador = ""}: CatalogoOperadorProps) {
    const [publicacionSeleccionada, setPublicacionSeleccionada] = useState<PublicacionPerfil | null>(null);
    const [drawerAbierto, setDrawerAbierto] = useState(false);

    function abrirDrawer(publicacion: PublicacionPerfil) {
        setPublicacionSeleccionada(publicacion);
        setDrawerAbierto(true);
    }

    return (
        <>
            <section className={styles.contenedor}>
                <div className={styles.catalogo}>
                    <h2 className={styles.titulo}>Productos</h2>
                    <div className={styles.placeholderFiltros}>
                        Filtros
                    </div>
                    {publicaciones.length > 0 ? (
                        <div className={styles.lista}>
                            {publicaciones.map((publicacion) => (
                                <TarjetaPublicacion key={publicacion.id} publicacion={publicacion} onSeleccionar={abrirDrawer}/>
                            ))}
                        </div>
                    ) : (
                        <p className={styles.sinResultados}>No hay publicaciones disponibles.</p>
                    )}
                </div>
            </section>
            <DrawerPublicacionPerfil publicacion={publicacionSeleccionada} open={drawerAbierto} onOpenChange={setDrawerAbierto} whatsAppOperador={whatsAppOperador}/>
        </>
    );
}