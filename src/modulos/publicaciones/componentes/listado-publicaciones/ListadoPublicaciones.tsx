"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import Paginacion from "@/compartido/componentes/Paginacion";

import type { PublicacionListado } from "../../../consulta-mercado/acciones/PublicacionesOperador";
import type { PublicacionProductorListado } from "../../../consulta-mercado/acciones/PublicacionesProductor";

import TarjetaPublicacionConOperador from "../tarjetas-publicacion/TarjetaPublicacionConOperador";
import TarjetaPublicacionSinOperador from "../tarjetas-publicacion/TarjetaPublicacionSinOperador";
import TarjetaPublicacionConProductor from "../tarjetas-publicacion/TarjetaPublicacionConProductor";
import TarjetaPublicacionSinProductor from "../tarjetas-publicacion/TarjetaPublicacionSinProductor";
import { DrawerPublicacion } from "../drawer-publicacion/DrawerPublicacion";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import styles from "./ListadoPublicaciones.module.css";


type TiposPublicacion = {
    operador: PublicacionListado;
    productor: PublicacionProductorListado;
};

type Publicacion = TiposPublicacion[keyof TiposPublicacion];

type Props = {
    publicaciones: Publicacion[];
    claveConsulta?: string;
    esAdmin?: boolean;
    estadoVacio?: ReactNode;
};

const publicacionesPorPagina = 20;

type GrupoPublicaciones = {
    clave: string;
    nombreFantasia: string;
    publicaciones: Publicacion[];
};

export default function ListadoPublicaciones({ publicaciones, claveConsulta = "", esAdmin = false, estadoVacio }: Props) {
    const [agrupar, setAgrupar] = useState(false);
    const [paginacion, setPaginacion] = useState({ claveConsulta, pagina: 1 });
    const totalPaginas = Math.ceil(publicaciones.length / publicacionesPorPagina);
    const paginaVisible = Math.min(paginacion.claveConsulta === claveConsulta ? paginacion.pagina : 1, Math.max(1, totalPaginas));
    if (paginacion.claveConsulta !== claveConsulta || paginacion.pagina !== paginaVisible) {
        setPaginacion({ claveConsulta, pagina: paginaVisible });
    }
    const indiceInicial = (paginaVisible - 1) * publicacionesPorPagina;
    const publicacionesPagina = useMemo(
        () => publicaciones.slice(indiceInicial, indiceInicial + publicacionesPorPagina),
        [publicaciones, indiceInicial],
    );
    const [publicacionSeleccionada, setPublicacionSeleccionada] = useState<Publicacion>();
    const [drawerAbierto, setDrawerAbierto] = useState(false);
    const seleccionActual = publicacionSeleccionada ? publicaciones.find((publicacion) => publicacion.id === publicacionSeleccionada.id && publicacion.tipoPublicacion === publicacionSeleccionada.tipoPublicacion) : undefined;

    const [mostrarBotonArriba, setMostrarBotonArriba] = useState(false);

    const publicacionesAgrupadas = useMemo(() => {
        const grupos = new Map<string, GrupoPublicaciones>();

        for (const publicacion of publicacionesPagina) {
            const usuario = "productor" in publicacion ? publicacion.productor : publicacion.operador;
            const clave = `${publicacion.tipoPublicacion}-${usuario.id}`;
            const grupo = grupos.get(clave);
            if (grupo) {
                grupo.publicaciones.push(publicacion);
            } else {
                grupos.set(clave, {clave, nombreFantasia: usuario.nombreFantasia, publicaciones: [publicacion]});
            }
        }
        return Array.from(grupos.values());
    }, [publicacionesPagina]);

    function abrirPublicacion(publicacion: Publicacion) {
        setPublicacionSeleccionada(publicacion);
        setDrawerAbierto(true);
    }

    function renderizarTarjeta(publicacion: Publicacion, mostrarUsuario: boolean) {
        const onClick = () => abrirPublicacion(publicacion);
        if ("productor" in publicacion) {
            return mostrarUsuario ? (
                <TarjetaPublicacionConProductor
                    publicacion={publicacion}
                    onClick={onClick}
                />
            ) : (
                <TarjetaPublicacionSinProductor
                    publicacion={publicacion}
                    onClick={onClick}
                />
            );
        }

        return mostrarUsuario ? (
            <TarjetaPublicacionConOperador
                publicacion={publicacion}
                onClick={onClick}
            />
        ) : (
            <TarjetaPublicacionSinOperador
                publicacion={publicacion}
                onClick={onClick}
            />
        );
    }
    
    useEffect(() => {
        const actualizarBotonArriba = () => { setMostrarBotonArriba(window.scrollY > 400) };
        actualizarBotonArriba();
        window.addEventListener("scroll", actualizarBotonArriba, {passive: true});
        return () => { window.removeEventListener("scroll", actualizarBotonArriba) };
    }, []);

    function volverArriba() {
        window.scrollTo({ top: 0, behavior: "smooth"});
    }

    if (publicaciones.length === 0) {
        return estadoVacio ?? (
            <EstadoVacio
                titulo="No hay publicaciones que coincidan con la búsqueda."
                descripcion="Probá cambiando o limpiando los filtros para ver otros productos."
                icono={<SearchOffOutlinedIcon />}
            />
        );
    }

    const esListadoProductores = publicaciones.every((publicacion) => publicacion.tipoPublicacion === "PRODUCTOR");
    return (
        <div>
            <div className={styles.encabezado}>
                <div className={styles.titulo}>
                    {esListadoProductores ? "Publicaciones" : "Publicaciones"}
                </div>
                <button
                    type="button"
                    onClick={() => setAgrupar((anterior) => !anterior)}
                    aria-pressed={agrupar}
                    className={`${styles.botonAgrupar} ${
                        agrupar ? styles.botonAgruparActivo : ""
                    }`}
                >
                    <span key={agrupar ? "desagrupar" : "agrupar"} className={styles.textoAgrupar}>
                        {agrupar ? (
                            <ViewListIcon fontSize="small" />
                        ) : (
                            <ViewModuleIcon fontSize="small" />
                        )}
                            {agrupar ? "Desagrupar" : "Agrupar"}
                    </span>
                </button>
            </div>
            {agrupar ? (
                <div className={styles.grupos}>
                    {publicacionesAgrupadas.map((grupo) => (
                        <div key={grupo.clave}>
                            <div className={styles.encabezadoGrupo}>
                                <div className={styles.nombreGrupo}>
                                    {grupo.nombreFantasia}
                                </div>
                                <div className={styles.resumenGrupo}>
                                    <div className={styles.cantidadProductos}>
                                        <span className={styles.numeroProductos}>
                                            {grupo.publicaciones.length}
                                        </span>{" "}
                                        <span>
                                            {grupo.publicaciones.length === 1 ? "producto" : "productos"}
                                        </span>
                                        {totalPaginas > 1 && " en esta página"}
                                    </div>
                                    <div className={styles.lineaGrupo} />
                                </div>
                            </div>
                            <div className={styles.lista}>
                                {grupo.publicaciones.map((publicacion) => (
                                    <div key={publicacion.id} className={styles.elementoLista}>
                                        {renderizarTarjeta(publicacion, false)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={styles.lista}>
                    {publicacionesPagina.map((publicacion) => (
                        <div key={publicacion.id} className={styles.elementoLista}>
                            {renderizarTarjeta(publicacion, true)}
                        </div>
                    ))}
                </div>
            )}
            <Paginacion
                pagina={paginaVisible}
                totalPaginas={totalPaginas}
                alCambiar={(pagina) => setPaginacion({ claveConsulta, pagina })}
                etiqueta="Paginación de publicaciones"
                resumen={`${indiceInicial + 1}–${indiceInicial + publicacionesPagina.length} de ${publicaciones.length} publicaciones`}
            />
            {seleccionActual && (
                <DrawerPublicacion
                    publicacion={seleccionActual}
                    open={drawerAbierto}
                    onOpenChange={setDrawerAbierto}
                    esAdmin={esAdmin}
                />
            )}
            {mostrarBotonArriba && (
                <button type="button" onClick={volverArriba} aria-label="Volver arriba" className={styles.botonArriba}>
                    <KeyboardArrowUpIcon />
                </button>
            )}
        </div>
    );
}
