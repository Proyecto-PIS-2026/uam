// Para cuando integremos los filtros
// "use client";

// import { useState } from "react";
// import type { PublicacionListado } from "./acciones/publicaciones";
// import FiltrosPublicaciones from "./filtrosPublicaciones";
// import ListadoPublicaciones from "./listadoPublicaciones";

// type PropiedadesContenedorPublicaciones = {
//     publicaciones: PublicacionListado[];
// };

// export default function ContenedorPublicaciones({ publicaciones }: PropiedadesContenedorPublicaciones) {
//   const [publicacionesFiltradas, setPublicacionesFiltradas] = useState(publicaciones);
//   return (
//     <>
//       <FiltrosPublicaciones publicaciones={publicaciones} alFiltrar={setPublicacionesFiltradas}/>
//       <ListadoPublicaciones  publicaciones={publicacionesFiltradas}/>
//     </>
//   );
// }