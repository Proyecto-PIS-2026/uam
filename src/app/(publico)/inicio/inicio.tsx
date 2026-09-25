/* ================================================= */
/* ==================== IMPORTS ==================== */
/* ================================================= */
"use client";
import { useEffect, useState } from "react";

import ProductoCard from "./tarjetaProducto";
import Header from "../../../compartido/header";

import Link from "next/link";

/* ================================================= */
/* ================= BASE DE DATOS ================= */
/* ================================================= */
type Props = {
  especies: {
    idEspecie: number;
    nombreEspecie: string;
    fotoEspecie: string | null;
    cantidadOperadores: number;
  }[];
};

export default function Inicio({ especies }: Props) {

/* ================================================= */
/* =================== VARIABLES =================== */
/* ================================================= */
  const especiesActivas = [...especies].sort((a, b) =>
  a.nombreEspecie.localeCompare(b.nombreEspecie, "es"));

  const especiesPorPagina = 20;
  const [paginaActual, setPaginaActual] = useState(1);
  const totalPaginas = Math.ceil(especiesActivas.length / especiesPorPagina);
  const indiceInicial = (paginaActual - 1) * especiesPorPagina;
  const indiceFinal = indiceInicial + especiesPorPagina;
  const especiesPagina = especiesActivas.slice(indiceInicial, indiceFinal);
  const [favoritosSeleccionado, setFavoritosSeleccionado] = useState(false);
  const volverAlInicio = () => {
    setPaginaActual(1);
    setFavoritosSeleccionado(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="bg-[var(--color-background)] min-h-screen">

      <Header />

     {/* ================================================= */
      /* ================ MERCADO DE HOY ================= */
      /* ================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 items-center">
        <div className="flex justify-center px-6 py-4 md:py-10">
          <h1 className="text-7xl md:text-8xl font-extrabold leading-none text-left pt-7 md:pt-10 text-[var(--color-foreground)]">
            <span className="text-[var(--color-primary)]">Mercado</span>
          <br />
            de hoy
          </h1>
        </div>

        <div className="relative flex flex-col items-center justify-center">
          
        {/* FOTO VERDURAS: */}
          <img
            src="https://elpueblodigital.uy/wp-content/uploads/2026/08/frutas-y-verduras-1024x768-png.webp"
            alt="Verduras frescas de feria"
            className="hidden lg:block w-full h-56 md:h-100 object-cover"
          />
        {/* DIFUMINADO HACIA EL FONDO */}
          <div className="absolute inset-0 hidden lg:block bg-gradient-to-l from-transparent via-transparent to-[var(--color-background)]" />
           
        {/* LOGO UAM SOBRE LA FOTO */}
          <div className="absolute top-15 left-1/2 -translate-x-1/2 z-10 h-70 w-50 overflow-hidden">
            <img
              src="https://uamservicios.uy/images/logo_white.png"
              alt="UAM"
              className="h-70 w-auto max-w-none hidden lg:block"
            />
          </div>
        </div>

      </div>

     {/* ================================================= */
      /* ======== ACCESOS PRINCIPALES (4 BOTONES) ======== */
      /* ================================================= */}
      <div className="p-6 mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/productos" className="boton-inicio">Ver productos</Link>
          <Link href="/operadores" className="boton-inicio">Ver operadores</Link>
          <Link href="/lista-inteligente" className="boton-inicio">Lista inteligente</Link>
          <Link href="/precios" className="boton-inicio">Precios de referencia</Link>
        </div>
      </div>

     {/* ================================================= */
      /* ======== SUBTITULO / FILTROS / BUSQUEDA ========= */
      /* ================================================= */}
      <section className="px-4 sm:px-8 pb-16">
        <h2 className="text-5xl pt-3 sm: pt-0 sm:text-7xl font-bold text-gray-900 mb-4 tracking-tight">
          Especies
        </h2>

        <div className="flex flex-row items-center justify-between mb-2">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setFavoritosSeleccionado(false)}
              className={`px-5 py-2 rounded-full font-semibold text-sm transition-all ${
                !favoritosSeleccionado
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-foreground)] hover:text-[var(--color-secondary)]"
              }`}
            >
              Todos
            </button>

            <button
              onClick={() => setFavoritosSeleccionado(true)}
              className={`px-5 py-2 rounded-full font-semibold text-sm transition-all ${
                favoritosSeleccionado
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-foreground)] hover:text-[var(--color-secondary)]"
              }`}
            >
              Favoritos
            </button>
          </div>
          <span className="text-[10px] md:text-base font-bold text-gray-500 tracking-wide mb-1">
            {especiesActivas.length} ESPECIES PUBLICADAS
          </span>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Buscar producto"
              className="w-full h-12 pl-11 pr-4 rounded-xl border border-gray-200/70 bg-white/70 text-[var(--color-foreground)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]"
            />
          </div>
          <button className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-xl border border-[var(--color-primary)] text-[var(--color-primary)]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M4 6h16M8 12h8M11 18h2" strokeLinecap="round" />
              <circle cx="14" cy="6" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="10" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="15" cy="18" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>

        <div className="flex justify-end items-center gap-2 mb-5">
          <span className="text-xs font-bold text-gray-500 tracking-wide">ORDENAR POR:</span>
          <select className="text-sm font-bold text-[var(--color-primary)] bg-transparent focus:outline-none">
            <option>...</option>
            <option>...</option>
            <option>...</option>
          </select>
        </div>
      
    {/* ================================================= */
     /* ========= MOSTRAR TARJETAS DE ESPECIES ========== */
     /* ================================================= */}      
        {especiesPagina.length === 0 ? (
          <p className="text-center text-gray-500 py-16">
            No hay especies que coincidan con la búsqueda.
          </p>
        ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-5">
            {especiesPagina.map((e) => (
              <ProductoCard
                key={e.idEspecie}
                nombre={e.nombreEspecie}
                operadores={e.cantidadOperadores}
                imagen={e.fotoEspecie || undefined}
              />
            ))}
          </div>

     {/* ================================================= */
      /* == ANTERIOR / SELECTOR DE PAGINA / SIGUIENTE  === */
      /* ================================================= */}
          <div className="flex justify-center items-center gap-2 mt-8">

            <button
              onClick={() => setPaginaActual(paginaActual - 1)}
              disabled={paginaActual === 1}
              className="boton-paginacion px-4 py-2"
            >
              ← Anterior
            </button>

            {/* Pagina anterior - Pagina actual - Pagina siguiente */}
            {Array.from(
              { length: Math.min(3, totalPaginas) },
              (_, i) => Math.max(1, Math.min(paginaActual - 1, totalPaginas - 2)) + i
            ).map((pagina) => (
              <button
                key={pagina}
                onClick={() => setPaginaActual(pagina)}
                className={
                  paginaActual === pagina
                    ? "w-10 h-10 rounded-lg font-semibold bg-[var(--color-secondary)] text-white"
                    : "boton-paginacion w-10 h-10"
                }
              >
                {pagina}
              </button>
            ))}

            {/* ... */}
            {totalPaginas > 4 && paginaActual < totalPaginas - 2 && (
              <span className="px-1 text-gray-500">...</span>
            )}

            {/* Última página */}
            {totalPaginas > 3 && paginaActual < totalPaginas - 1 && (
              <button
                onClick={() => setPaginaActual(totalPaginas)}
                className={
                  paginaActual === totalPaginas
                    ? "w-10 h-10 rounded-lg font-semibold bg-[var(--color-secondary)] text-white"
                    : "boton-paginacion w-10 h-10"
                }
              >
                {totalPaginas}
              </button>
            )}

            <button
              onClick={() => setPaginaActual(paginaActual + 1)}
              disabled={paginaActual === totalPaginas}
              className="boton-paginacion px-4 py-2"
            >
              Siguiente →
            </button>

          </div>

          {/* VOLVER AL INICIO */}
          <div className="flex justify-center mt-1">
            <button
              onClick={volverAlInicio}
              className="text-sm text-[var(--color-primary)] underline hover:text-[var(--color-secondary)] transition-colors"
            >
              Volver al inicio
            </button>
          </div>
        </>
        )}
      </section>
    </main>
  );
}