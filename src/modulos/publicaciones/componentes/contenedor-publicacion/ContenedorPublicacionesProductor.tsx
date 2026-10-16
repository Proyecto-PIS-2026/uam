"use client";

import { useState } from "react";
import type { PublicacionProductorListado } from "../../../consulta-mercado/acciones/PublicacionesProductor";
import FiltrosPublicacionesProductor, { compararPublicacionesPorPrioridad } from "../../filtros/FiltrosPublicacionesProductor";
import ListadoPublicacionesProductor from "../listado-publicaciones/ListadoPublicacionesProductor";

type PropiedadesContenedorPublicacionesProductor = {
    publicaciones: PublicacionProductorListado[];
    especie?: string;
};

export default function ContenedorPublicacionesProductor({ publicaciones, especie = "" }: PropiedadesContenedorPublicacionesProductor) {
    const especieValida = especie !== "" && publicaciones.some((publicacion) => publicacion.especie === especie) ? especie : "";
    return (<ContenidoPublicacionesProductor key={especieValida} publicaciones={publicaciones} especie={especieValida}/>);
}

function ContenidoPublicacionesProductor({ publicaciones, especie = "" }: PropiedadesContenedorPublicacionesProductor) {
    const [publicacionesFiltradas, setPublicacionesFiltradas] = useState(() => {
        const iniciales = especie ? publicaciones.filter((publicacion) => publicacion.especie === especie) : [...publicaciones];
        return iniciales.sort(compararPublicacionesPorPrioridad);
    });
    function actualizarEspecieEnUrl(nuevaEspecie: string) {
        const url = new URL(window.location.href);
        if (nuevaEspecie === "Todas") {
            url.searchParams.delete("especie");
        } else {
            url.searchParams.set("especie", nuevaEspecie);
        }
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    return (
        <div className="flex flex-col gap-6">
            <FiltrosPublicacionesProductor publicaciones={publicaciones} especieFiltro={especie} ordenInicial="prioridad" alFiltrar={setPublicacionesFiltradas} alCambiarEspecie={actualizarEspecieEnUrl} alLimpiar={() => actualizarEspecieEnUrl("Todas")}/>
            <ListadoPublicacionesProductor publicaciones={publicacionesFiltradas}/>
        </div>
    );
}