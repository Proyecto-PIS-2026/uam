"use client";

import type { PublicacionProductorListado } from "../../../consulta-mercado/acciones/PublicacionesProductor";
import styles from "./ListadoPublicacionesUnificado.module.css";

import TarjetaPublicacionConProductor from "@/modulos/publicaciones/componentes/tarjetas-publicacion/TarjetaPublicacionConProductor";
import TarjetaPublicacionSinProductor from "@/modulos/publicaciones/componentes/tarjetas-publicacion/TarjetaPublicacionSinProductor";
import { DrawerDerechaPublicacion } from "@/modulos/publicaciones/componentes/drawer-publicacion/DrawerDerechaPublicacion";
import { DrawerAbajoPublicacion} from "@/modulos/publicaciones/componentes/drawer-publicacion/DrawerAbajoPublicacion";

import { useEffect, useMemo, useState } from "react";

import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import useMediaQuery from "@mui/material/useMediaQuery";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

type PublicacionesAgrupadasPorProductor = {
    id: number;
    nombreFantasia: string;
    publicaciones: PublicacionProductorListado[];
};

const clasesLista = "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";

export default function ListadoPublicacionesProductor({ publicaciones }: { publicaciones: PublicacionProductorListado[] }) {
    const [agruparPorProductor, setAgruparPorProductor] = useState(false);
    const [publicacionSeleccionada, setPublicacionSeleccionada] = useState<PublicacionProductorListado | null>(null);
    const [drawerAbierto, setDrawerAbierto] = useState(false);
    const esMobile = useMediaQuery("(max-width: 767px)");
    const [mostrarBotonArriba, setMostrarBotonArriba] = useState(false);
    const [animandoSalida, setAnimandoSalida] = useState(false);

    useEffect(() => {
        const manejarScroll = () => {
            if (window.scrollY > 400) {
                setMostrarBotonArriba(true);
                setAnimandoSalida(false);
            } else if (mostrarBotonArriba) {
                setAnimandoSalida(true);
                window.setTimeout(() => {
                    setMostrarBotonArriba(false);
                    setAnimandoSalida(false);
                }, 400);
            }
        };
        window.addEventListener("scroll", manejarScroll);
        return () => { window.removeEventListener("scroll", manejarScroll); };
    }, [mostrarBotonArriba]);

    function abrirPublicacion(publicacion: PublicacionProductorListado) {
        setPublicacionSeleccionada(publicacion);
        setDrawerAbierto(true);
    }

    const publicacionesAgrupadas = useMemo(() => {
        const grupos = new Map<number, PublicacionesAgrupadasPorProductor>();

        for (const publicacion of publicaciones) {
            const grupo = grupos.get(publicacion.productor.id);

            if (grupo) {
                grupo.publicaciones.push(publicacion);
            } else {
                grupos.set(publicacion.productor.id, {
                    id: publicacion.productor.id,
                    nombreFantasia: publicacion.productor.nombreFantasia,
                    publicaciones: [publicacion],
                });
            }
        }

        return Array.from(grupos.values());
    }, [publicaciones]);

    if (publicaciones.length === 0) return (<p role="status" className="text-[var(--color-primary)]"> No hay publicaciones que coincidan con la búsqueda. </p>);
    
    function volverArriba() {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    return (
        <div>
            <div className="mb-6 flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                <h1 className="text-2xl font-semibold text-[var(--color-secondary)]"> Publicaciones de productores </h1>
                <button type="button" onClick={() => setAgruparPorProductor(!agruparPorProductor)}
                    className={`inline-flex w-33 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-200 active:scale-95 
                        ${agruparPorProductor ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]" : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"}`}
                >
                    {agruparPorProductor ? (<><ViewListIcon fontSize="small"/> Desagrupar </>) : (<><ViewModuleIcon fontSize="small"/> Agrupar </>)}
                </button>
            </div>
            {agruparPorProductor ? (
                <div className="flex flex-col gap-6">
                    {publicacionesAgrupadas.map((productor) => (
                        <div key={productor.id}>
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold text-[var(--color-primary)]"> {productor.nombreFantasia} </h2>
                                <div className="mt-1 flex items-center gap-3">
                                    <div className="text-sm text-[var(--color-muted)]">
                                        <span className="font-semibold text-[var(--color-primary)]"> {productor.publicaciones.length} </span>{" "} productos
                                    </div>
                                    <div className="h-px flex-1 bg-[var(--color-border)]" />
                                </div>
                            </div>
                            <ul className={clasesLista}>
                                {productor.publicaciones.map((publicacion) => (
                                    <li key={publicacion.id}>
                                        <TarjetaPublicacionSinProductor publicacion={publicacion} onClick={() => abrirPublicacion(publicacion)}/>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            ) : (
                <ul className={clasesLista}>
                    {publicaciones.map((publicacion) => (
                        <li key={publicacion.id}>
                            <TarjetaPublicacionConProductor publicacion={publicacion} onClick={() => abrirPublicacion(publicacion)}/>
                        </li>
                    ))}
                </ul>
            )}
            {publicacionSeleccionada && (esMobile ? (
                <DrawerAbajoPublicacion publicacion={publicacionSeleccionada} open={drawerAbierto} onOpenChange={setDrawerAbierto}/>
            ) : (
                <DrawerDerechaPublicacion publicacion={publicacionSeleccionada} open={drawerAbierto} onOpenChange={setDrawerAbierto}/>
            ))}
            {mostrarBotonArriba && (
                <button type="button" onClick={volverArriba} aria-label="Volver arriba" className={`${styles.botonArriba} ${animandoSalida ? styles.botonArribaOcultando : styles.botonArribaVisible}`}>
                    <KeyboardArrowUpIcon/>
                </button>
            )}
        </div>
    );
}
