"use client";

import { useState } from "react";
import type { PublicacionListado } from "../../../consulta-mercado/acciones/PublicacionesOperador";
import FiltrosPublicaciones, { compararPublicacionesPorPrioridad } from "../../filtros/FiltrosPublicaciones";
import ListadoPublicaciones from "../listado-publicaciones/ListadoPublicaciones";
import type { PublicacionProductorListado } from "../../../consulta-mercado/acciones/PublicacionesProductor";

type Publicacion = PublicacionListado | PublicacionProductorListado;

const obtenerNombreFantasia = (publicacion: Publicacion) => publicacion.tipoPublicacion === "OPERADOR" ? publicacion.operador.nombreFantasia : publicacion.productor.nombreFantasia;

type PropiedadesContenedorPublicaciones = {
    publicaciones: Publicacion[];
    especie?: string;
    esAdmin?: boolean;
};

export default function ContenedorPublicaciones({ publicaciones, especie = "", esAdmin = false }: PropiedadesContenedorPublicaciones) {
	const especieValida = especie !== "" && publicaciones.some((publicacion) => publicacion.especie === especie) ? especie : "";
	return <ContenidoPublicaciones key={especieValida} publicaciones={publicaciones} especie={especieValida} esAdmin={esAdmin} />;
}

function ContenidoPublicaciones({publicaciones, especie = "", esAdmin = false}: PropiedadesContenedorPublicaciones) {
	const [publicacionesFiltradas, setPublicacionesFiltradas] = useState(() => {
		const iniciales = especie ? publicaciones.filter((publicacion) => publicacion.especie === especie) : [...publicaciones];
		return iniciales.sort(compararPublicacionesPorPrioridad);
	});

	function actualizarEspecieEnUrl(nuevaEspecie: string) {
		const url = new URL(window.location.href);
		if (nuevaEspecie === "Todas") url.searchParams.delete("especie");
		else url.searchParams.set("especie", nuevaEspecie);
		window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
	}

	return (
		<div className="flex flex-col gap-6">
			<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreFantasia} publicaciones={publicaciones} especieFiltro={especie} ordenInicial="prioridad" alFiltrar={setPublicacionesFiltradas} alCambiarEspecie={actualizarEspecieEnUrl} alLimpiar={() => actualizarEspecieEnUrl("Todas")}/>
			<ListadoPublicaciones esAdmin={esAdmin} publicaciones={publicacionesFiltradas} />
		</div>
	);
}