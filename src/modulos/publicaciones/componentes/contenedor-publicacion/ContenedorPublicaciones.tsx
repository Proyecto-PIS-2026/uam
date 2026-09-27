"use client";

import { useState } from "react";
import type { PublicacionListado } from "../../../consulta-mercado/acciones/Publicaciones";
import FiltrosPublicaciones from "../../filtros/FiltrosPublicaciones"
import ListadoPublicaciones from "../listado-publicaciones/ListadoPublicacionesUnificado";

type PropiedadesContenedorPublicaciones = {
	publicaciones: PublicacionListado[];
	especie?: string;
};

export default function ContenedorPublicaciones({ publicaciones, especie = "" }: PropiedadesContenedorPublicaciones) {
	const [publicacionesFiltradas, setPublicacionesFiltradas] = useState(publicaciones);
	const especieValida = especie !== "" && publicaciones.some((publicacion) => publicacion.especie === especie) ? especie : "";
	return (
		<div className="flex flex-col gap-8">
			<FiltrosPublicaciones publicaciones={publicaciones} especieFiltro={especieValida} alFiltrar={setPublicacionesFiltradas}/>
			<ListadoPublicaciones publicaciones={publicacionesFiltradas} />
		</div>
	);
}