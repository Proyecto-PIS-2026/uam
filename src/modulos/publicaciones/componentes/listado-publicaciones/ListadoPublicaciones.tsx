"use client";

import { useEffect, useMemo, useState } from "react";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";

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
    esAdmin?: boolean;
};

type GrupoPublicaciones = {
    clave: string;
    nombreFantasia: string;
    publicaciones: Publicacion[];
};

export default function ListadoPublicaciones({ publicaciones, esAdmin = false }: Props) {
    const [agrupar, setAgrupar] = useState(false);
    const [publicacionSeleccionada, setPublicacionSeleccionada] = useState<Publicacion>();
    const [drawerAbierto, setDrawerAbierto] = useState(false);

    const [mostrarBotonArriba, setMostrarBotonArriba] = useState(false);

    const publicacionesAgrupadas = useMemo(() => {
        const grupos = new Map<string, GrupoPublicaciones>();

        for (const publicacion of publicaciones) {
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
    }, [publicaciones]);

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
        return (
            <div role="status" className={styles.sinResultados}>
                No hay publicaciones que coincidan con la búsqueda.
            </div>
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
                    {agrupar ? (
                        <ViewListIcon fontSize="small" />
                    ) : (
                        <ViewModuleIcon fontSize="small" />
                    )}
                    <span>{agrupar ? "Desagrupar" : "Agrupar"}</span>
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
                    {publicaciones.map((publicacion) => (
                        <div key={publicacion.id} className={styles.elementoLista}>
                            {renderizarTarjeta(publicacion, true)}
                        </div>
                    ))}
                </div>
            )}
            {publicacionSeleccionada && (
                <DrawerPublicacion
                    publicacion={publicacionSeleccionada}
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