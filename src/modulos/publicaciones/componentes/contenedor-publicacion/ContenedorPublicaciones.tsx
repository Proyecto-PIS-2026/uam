"use client";
// ELIMINAR COMENTARIOS PARA CUANDO SE PUEDA INTEGRAR CON LOS FILTROS
//import { useState, useEffect } from "react";
import type { PublicacionListado } from "../../../consulta-mercado/acciones/Publicaciones";
//import FiltrosPublicaciones from "./../filtrosPublicaciones";
import ListadoPublicaciones from "../listado-publicaciones/ListadoPublicacionesUnificado";

type PropiedadesContenedorPublicaciones = {
  publicaciones: PublicacionListado[];
};

export default function ContenedorPublicaciones({ publicaciones }: PropiedadesContenedorPublicaciones) {
  //const [publicacionesFiltradas, setPublicacionesFiltradas] = useState(publicaciones);
  return (
    <div className="flex flex-col gap-8">
      {/* <FiltrosPublicaciones publicaciones={publicaciones} alFiltrar={setPublicacionesFiltradas}/> */}
      <ListadoPublicaciones publicaciones={publicaciones} />
    </div>
  );
}