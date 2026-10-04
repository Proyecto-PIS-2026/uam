"use client";

import { useState } from "react";
import type { PublicacionListado } from "../../../consulta-mercado/acciones/Publicaciones";
import FiltrosPublicaciones, { compararPublicacionesPorPrioridad } from "../../filtros/FiltrosPublicaciones";
import ListadoPublicaciones from "../listado-publicaciones/ListadoPublicacionesUnificado";

type PropiedadesContenedorPublicaciones = {
	publicaciones: PublicacionListado[];
	especie?: string;
};

export default function ContenedorPublicaciones({ publicaciones, especie = "" }: PropiedadesContenedorPublicaciones) {
	const especieValida = especie !== "" && publicaciones.some((publicacion) => publicacion.especie === especie) ? especie : "";
	return <ContenidoPublicaciones key={especieValida} publicaciones={publicaciones} especie={especieValida} />;
}

function ContenidoPublicaciones({publicaciones, especie = ""}: PropiedadesContenedorPublicaciones) {
	const [publicacionesFiltradas, setPublicacionesFiltradas] = useState(() => {
		const iniciales = especie ? publicaciones.filter((publicacion) => publicacion.especie === especie) : [...publicaciones];
		return iniciales.sort(compararPublicacionesPorPrioridad);
	});

	function quitarEspecieDeUrl() {
		const url = new URL(window.location.href);
		if (!url.searchParams.has("especie")) return;
		url.searchParams.delete("especie");
		window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
	}

	return (
		<div className="flex flex-col gap-6">
			<FiltrosPublicaciones publicaciones={publicaciones} especieFiltro={especie} ordenInicial="prioridad" alFiltrar={setPublicacionesFiltradas} alLimpiar={quitarEspecieDeUrl}/>
			<ListadoPublicaciones publicaciones={publicacionesFiltradas} />
		</div>
	);
}
