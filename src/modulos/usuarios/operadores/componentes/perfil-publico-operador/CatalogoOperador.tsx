"use client";

import { useMemo, useState } from "react";
import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import FiltrosPublicaciones, { compararPublicacionesPorPrioridad, type OrdenPublicaciones } from "../../../../publicaciones/filtros/FiltrosPublicaciones";
import type { PublicacionListado } from "../../../../consulta-mercado/acciones/PublicacionesOperador";
import { compararEspeciesPorPrioridad } from "../../../../../compartido/prioridad-especies";
import { DrawerPublicacionPerfil } from "./DrawerPublicacionPerfil";
import TarjetaPublicacion from "./TarjetaPublicacion";

import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";

import styles from "./CatalogoOperador.module.css";

const obtenerNombreOperador = (publicacion: PublicacionListado) => publicacion.operador.nombreFantasia;

type CatalogoOperadorProps = {
    publicaciones: PublicacionPerfil[];
    whatsAppOperador?: string;
    idOperador?: number;
    nombreOperador?: string;
};

export default function CatalogoOperador({publicaciones, whatsAppOperador = "", idOperador = 0, nombreOperador = ""}: CatalogoOperadorProps) {
    const [publicacionSeleccionada, setPublicacionSeleccionada] = useState<PublicacionPerfil | null>(null);
    const [drawerAbierto, setDrawerAbierto] = useState(false);
    const [agruparPorEspecie, setAgruparPorEspecie] = useState(false);
    const [ordenActual, setOrdenActual] = useState<OrdenPublicaciones>("prioridad");
    const publicacionesParaFiltros = useMemo<PublicacionListado[]>(() => publicaciones.map((publicacion) => ({
        ...publicacion,
        precio: publicacion.precio === null ? null : Number(publicacion.precio),
        codigoCalibre: publicacion.calibre,
        tipoPublicacion: "OPERADOR",
        operador: {id: idOperador, nombreFantasia: nombreOperador, whatsApp: whatsAppOperador},
    })), [publicaciones, idOperador, nombreOperador, whatsAppOperador]);
    const [publicacionesFiltradas, setPublicacionesFiltradas] = useState(() => [...publicacionesParaFiltros].sort(compararPublicacionesPorPrioridad));

    const publicacionesPorId = new Map(publicaciones.map((publicacion) => [publicacion.id, publicacion]));
    const publicacionesVisibles: PublicacionPerfil[] = [];
    for (const publicacionFiltrada of publicacionesFiltradas) {
        const publicacion = publicacionesPorId.get(publicacionFiltrada.id);
        if (publicacion) publicacionesVisibles.push(publicacion);
    }

    function abrirDrawer(publicacion: PublicacionPerfil) {
        setPublicacionSeleccionada(publicacion);
        setDrawerAbierto(true);
    }

    const publicacionesPorEspecie = publicacionesVisibles.reduce<Record<string, PublicacionPerfil[]>>((grupos, publicacion) => {
        const especie = publicacion.especie;

        if (!grupos[especie]) {
            grupos[especie] = [];
        }

        grupos[especie].push(publicacion);

        return grupos;
    }, {});
    const gruposOrdenados = Object.entries(publicacionesPorEspecie).sort(([primera], [segunda]) => {
        if (ordenActual === "alfabeticoAsc") return primera.localeCompare(segunda, "es", {sensitivity: "base"});
        if (ordenActual === "alfabeticoDesc") return segunda.localeCompare(primera, "es", {sensitivity: "base"});
        return compararEspeciesPorPrioridad(primera, segunda);
    });

    const publicacionParaDrawer = publicacionSeleccionada ? publicacionesParaFiltros.find((publicacion) => publicacion.id === publicacionSeleccionada.id) ?? null : null;

    return (
        <>
            <section className={styles.contenedor}>
                <div className={styles.catalogo}>
                    <div className={styles.filtros}>
                        <FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesParaFiltros} especieFiltro="" ordenInicial="prioridad" alFiltrar={setPublicacionesFiltradas} alCambiarOrden={setOrdenActual}/>
                    </div>

                    <div className={styles.encabezadoCatalogo}>
                        <h2 className={styles.titulo}>Publicaciones</h2>
                        <div className={styles.espacioAgrupar}>
                            <button type="button" className={`${styles.botonAgrupar} ${agruparPorEspecie ? styles.botonAgruparActivo : ""}`} aria-pressed={agruparPorEspecie} onClick={() => setAgruparPorEspecie((valorActual) => !valorActual)}>
                                <span key={agruparPorEspecie ? "desagrupar" : "agrupar"} className={styles.textoAgrupar}>
                                    {agruparPorEspecie ? (
                                        <ViewListIcon fontSize="small" />
                                    ) : (
                                        <ViewModuleIcon fontSize="small" />
                                    )}
                                        {agruparPorEspecie ? "Desagrupar" : "Agrupar por especie"}
                                </span>
                            </button>
                        </div>
                    </div>

                    {publicacionesVisibles.length > 0 ? (
                        agruparPorEspecie ? (
                            <div className={styles.grupos}>
                                {gruposOrdenados.map(([especie, publicacionesEspecie]) => (
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
                                {publicacionesVisibles.map((publicacion) => (
                                    <TarjetaPublicacion key={publicacion.id} publicacion={publicacion} onSeleccionar={abrirDrawer}/>
                                ))}
                            </div>
                        )
                    ) : (
                        <p className={styles.sinResultados}>{publicaciones.length === 0 ? "No hay publicaciones disponibles." : "No hay publicaciones que coincidan con la búsqueda."}</p>
                    )}
                </div>
            </section>

            <DrawerPublicacionPerfil publicacion={publicacionParaDrawer} open={drawerAbierto} onOpenChange={setDrawerAbierto} />
        </>
    );
}
