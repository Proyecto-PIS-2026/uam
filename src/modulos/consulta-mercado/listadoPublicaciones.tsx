"use client";

import type {
  publicacionListado,
  operadorListado,
} from "./acciones/publicaciones";

import { PublicacionesOperador } from "@/modulos/publicaciones/componentes/ListadoProductosConOperador";
import { ProductoSinOperador } from "@/modulos/publicaciones/componentes/TarjetaProductoSinOperador";
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
  if (propiedades.agruparPorOperador) {
    if (propiedades.operadores.length === 0) {
      return <p role="status">No hay publicaciones que coincidan con la búsqueda.</p>;
    }
    console.log(propiedades.operadores);
    return (
      <div>
          {propiedades.operadores.map((operador) => (
          <PublicacionesOperador
            key={operador.id}
            nombreFantasia={operador.nombreFantasia}
            productos={operador.publicaciones}
            onProductoClick={(id) => console.log(id)}
          />
        ))}
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
        <ProductoSinOperador
          producto={publicacion}
          onClick={(id) => console.log(id)}
        />
      </li>
    ))}
    </ul>
  );
}
