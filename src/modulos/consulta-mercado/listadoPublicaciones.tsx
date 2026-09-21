"use client";

import type{
  publicacionListado,
  operadorListado,
  publicacionCompleta, 
} from "./acciones/publicaciones";

import { PublicacionesOperador } from "@/modulos/publicaciones/componentes/ListadoPublicacionConOperador";
import { PublicacionSinOperador } from "@/modulos/publicaciones/componentes/TarjetaPublicacionSinOperador";
import { DrawerPublicacion } from "@/modulos/publicaciones/componentes/DrawerPublicacion";
import { obtenerDetallePublicacion } from "./acciones/consultarPublicacion.action";
import { useState } from "react";

type propiedadesListadoPublicaciones =
  | {
      agruparPorOperador: false;
      publicaciones: publicacionListado[];
    }
  | {
      agruparPorOperador: true;
      operadores: operadorListado[];
    };

const clasesLista = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

export default function ListadoPublicaciones(
  propiedades: propiedadesListadoPublicaciones,
) {
  const [publicacionSeleccionada, setPublicacionSeleccionada] = useState<publicacionCompleta | null>(null);
  const [drawerAbierto, setDrawerAbierto] = useState(false); 

  const seleccionarPublicacion = async (id: number) => {
    const publicacion = await obtenerDetallePublicacion(id);
    if (publicacion !== null) {
      setPublicacionSeleccionada(publicacion);
      setDrawerAbierto(true); 
    }
  };
  if (propiedades.agruparPorOperador) {
    if (propiedades.operadores.length === 0) {
      return <p role="status">No hay publicaciones que coincidan con la búsqueda.</p>;
    }
    return (
      <div>
          {propiedades.operadores.map((operador) => (
          <PublicacionesOperador
            key={operador.id}
            nombreFantasia={operador.nombreFantasia}
            publicaciones={operador.publicaciones}
            onPublicacionClick={(id) => seleccionarPublicacion(id)}
          />
        ))}
        {publicacionSeleccionada !== null && (
          <DrawerPublicacion
            producto={publicacionSeleccionada}
            open={drawerAbierto}
            onOpenChange={setDrawerAbierto}
          />
          )}
      </div>
    );
  }
  if (propiedades.publicaciones.length === 0) {
    return <p role="status">No hay publicaciones que coincidan con la búsqueda.</p>;
  }
  return (
    <ul className={clasesLista}>
      {propiedades.publicaciones.map((publicacion) => (
      <li key={publicacion.id}>
        <PublicacionSinOperador
          producto={publicacion}
          onPublicacionClick={(id) => seleccionarPublicacion(id)}
        />
      </li>
    ))}
    </ul>
  );
}
