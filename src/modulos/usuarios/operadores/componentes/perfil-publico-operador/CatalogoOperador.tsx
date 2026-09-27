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
    const [agruparPorEspecie, setAgruparPorEspecie] = useState(false);

    function abrirDrawer(publicacion: PublicacionPerfil) {
        setPublicacionSeleccionada(publicacion);
        setDrawerAbierto(true);
    }

    const publicacionesPorEspecie = publicaciones.reduce<Record<string, PublicacionPerfil[]>>((grupos, publicacion) => {
        const especie = publicacion.especie;

        if (!grupos[especie]) {
            grupos[especie] = [];
        }

        grupos[especie].push(publicacion);

        return grupos;
    }, {});

    return (
        <>
            <section className={styles.contenedor}>
                <div className={styles.catalogo}>
                    <div className={styles.placeholderFiltros}>
                        Filtros
                    </div>

                    <div className={styles.encabezadoCatalogo}>
                        <h2 className={styles.titulo}>Publicaciones</h2>

                        <button type="button" className={`${styles.botonAgrupar} ${agruparPorEspecie ? styles.botonAgruparActivo : ""}`} aria-pressed={agruparPorEspecie} onClick={() => setAgruparPorEspecie((valorActual) => !valorActual)}>
                            {agruparPorEspecie ? "Desagrupar" : "Agrupar por especie"}
                        </button>
                    </div>

                    {publicaciones.length > 0 ? (
                        agruparPorEspecie ? (
                            <div className={styles.grupos}>
                                {Object.entries(publicacionesPorEspecie).map(([especie, publicacionesEspecie]) => (
                                    <section key={especie} className={styles.grupo}>
                                        <div className={styles.separadorGrupo}>
                                            <h3 className={styles.nombreEspecie}>{especie}</h3>

                                            <div className={styles.detalleGrupo}>
                                                <span className={styles.cantidadProductos}>{publicacionesEspecie.length}</span>
                                                <span className={styles.textoProductos}>{publicacionesEspecie.length === 1 ? "producto" : "productos"}</span>
                                                <span className={styles.lineaGrupo} aria-hidden="true"/>
                                            </div>
                                        </div>

                                        <div className={styles.lista}>
                                            {publicacionesEspecie.map((publicacion) => (
                                                <TarjetaPublicacion key={publicacion.id} publicacion={publicacion} onSeleccionar={abrirDrawer}/>
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.lista}>
                                {publicaciones.map((publicacion) => (
                                    <TarjetaPublicacion key={publicacion.id} publicacion={publicacion} onSeleccionar={abrirDrawer}/>
                                ))}
                            </div>
                        )
                    ) : (
                        <p className={styles.sinResultados}>No hay publicaciones disponibles.</p>
                    )}
                </div>
            </section>

            <DrawerPublicacionPerfil publicacion={publicacionSeleccionada} open={drawerAbierto} onOpenChange={setDrawerAbierto} whatsAppOperador={whatsAppOperador}/>
        </>
    );
}