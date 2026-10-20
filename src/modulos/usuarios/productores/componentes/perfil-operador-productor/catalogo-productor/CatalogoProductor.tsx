"use client";

import { useMemo, useState } from "react";
import type { PublicacionPerfilProductor } from "../../../acciones/consultas-perfil-por-operador";
import FiltrosPublicaciones, { compararPublicacionesPorPrioridad, type OrdenPublicaciones } from "../../../../../publicaciones/filtros/FiltrosPublicaciones";
import type { PublicacionProductorListado } from "@/modulos/consulta-mercado/acciones/PublicacionesProductor";
import { compararEspeciesPorPrioridad } from "../../../../../../compartido/prioridad-especies";
import { DrawerPublicacion } from "@/modulos/publicaciones/componentes/drawer-publicacion/DrawerPublicacion";
import TarjetaPublicacion from "../tarjetas-publicacion/TarjetaPublicacion";
import styles from "./CatalogoProductor.module.css";

const obtenerNombreProductor = (publicacion: PublicacionProductorListado) => publicacion.productor.nombreFantasia;

type CatalogoProductorProps = {
    publicaciones: PublicacionPerfilProductor[];
    whatsAppProductor?: string;
    idProductor?: number;
    nombreProductor?: string;
};

export default function CatalogoProductor({publicaciones, whatsAppProductor = "", idProductor = 0, nombreProductor = ""}: CatalogoProductorProps) {
    const [publicacionSeleccionada, setPublicacionSeleccionada] = useState<PublicacionPerfilProductor | null>(null);
    const [drawerAbierto, setDrawerAbierto] = useState(false);
    const [agruparPorEspecie, setAgruparPorEspecie] = useState(false);
    const [ordenActual, setOrdenActual] = useState<OrdenPublicaciones>("prioridad");
    const publicacionesParaFiltros = useMemo<PublicacionProductorListado[]>(() => publicaciones.map((publicacion) => ({
        ...publicacion,
        tipoPublicacion: "PRODUCTOR",
        precio: publicacion.precio === null ? null : Number(publicacion.precio),
        codigoCalibre: publicacion.calibre,
        productor: {id: idProductor, nombreFantasia: nombreProductor, whatsApp: whatsAppProductor, fotoPerfil: null},
    })), [publicaciones, idProductor, nombreProductor, whatsAppProductor]);
    const [publicacionesFiltradas, setPublicacionesFiltradas] = useState(() => [...publicacionesParaFiltros].sort(compararPublicacionesPorPrioridad));

    const publicacionesPorId = new Map(publicaciones.map((publicacion) => [publicacion.id, publicacion]));
    const publicacionesVisibles: PublicacionPerfilProductor[] = [];
    for (const publicacionFiltrada of publicacionesFiltradas) {
        const publicacion = publicacionesPorId.get(publicacionFiltrada.id);
        if (publicacion) publicacionesVisibles.push(publicacion);
    }

    function abrirDrawer(publicacion: PublicacionPerfilProductor) {
        setPublicacionSeleccionada(publicacion);
        setDrawerAbierto(true);
    }

    const publicacionesPorEspecie = publicacionesVisibles.reduce<Record<string, PublicacionPerfilProductor[]>>((grupos, publicacion) => {
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
    const contenido =  (
        <>
            <section className={styles.contenedor}>
                <div className={styles.catalogo}>
                    <div className={styles.filtros}>
                        <FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreProductor} publicaciones={publicacionesParaFiltros} especieFiltro="" ordenInicial="prioridad" alFiltrar={setPublicacionesFiltradas} alCambiarOrden={setOrdenActual}/>
                    </div>
                    <div className={styles.encabezadoCatalogo}>
                        <h2 className={styles.titulo}>Publicaciones</h2>
                        <button type="button" className={`${styles.botonAgrupar} ${agruparPorEspecie ? styles.botonAgruparActivo : ""}`} aria-pressed={agruparPorEspecie} onClick={() => setAgruparPorEspecie((valorActual) => !valorActual)}>
                            {agruparPorEspecie ? "Desagrupar" : "Agrupar por especie"}
                        </button>
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
            <DrawerPublicacion publicacion={publicacionParaDrawer} open={drawerAbierto} onOpenChange={setDrawerAbierto}/>
        </>
    );
    return contenido; 
}
