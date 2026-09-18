"use client";
import { useEffect, useState } from "react";

import ProductoCard from "./tarjetaProducto";
import Header from "../../../compartido/header";

import Link from "next/link";

const productos = [
  { nombre: "Ananá", variedad: "Unidad", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Banana Cavendish", variedad: "Grande", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Berenjena", variedad: "Grande", categoria: "Categoría I", operadores: 1, precio: 4, imagen: "https://images.unsplash.com/photo-1576045212914-51a8d7e7eef3?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Brócoli", variedad: "Unidad", categoria: "Categoría I", operadores: 2, precio: 58, imagen: "https://images.unsplash.com/photo-1685504445355-0e7bdf90d415?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Cebolla", variedad: "Mediana", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?q=80&w=400&auto=format&fit=crop" },
{ nombre: "Ananá2", variedad: "Unidad", categoria: "Categoría I", operadores: 3, precio: 58, imagen: "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Banana2 Cavendish", variedad: "Grande", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Berenjena2", variedad: "Grande", categoria: "Categoría I", operadores: 1, precio: 4, imagen: "https://images.unsplash.com/photo-1576045212914-51a8d7e7eef3?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Brócoli2", variedad: "Unidad", categoria: "Categoría I", operadores: 2, precio: 58, imagen: "https://images.unsplash.com/photo-1685504445355-0e7bdf90d415?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Cebolla2", variedad: "Mediana", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?q=80&w=400&auto=format&fit=crop" },
{ nombre: "Ananá3", variedad: "Unidad", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Banana3 Cavendish", variedad: "Grande", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Berenjena3", variedad: "Grande", categoria: "Categoría I", operadores: 5, precio: 4, imagen: "https://images.unsplash.com/photo-1576045212914-51a8d7e7eef3?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Brócoli3", variedad: "Unidad", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1685504445355-0e7bdf90d415?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Cebolla3", variedad: "Mediana", categoria: "Categoría I", operadores: 3, precio: 58, imagen: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?q=80&w=400&auto=format&fit=crop" },
{ nombre: "Ananá4", variedad: "Unidad", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Banana 4Cavendish", variedad: "Grande", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Berenjena4", variedad: "Grande", categoria: "Categoría I", operadores: 1, precio: 4, imagen: "https://images.unsplash.com/photo-1576045212914-51a8d7e7eef3?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Brócoli4", variedad: "Unidad", categoria: "Categoría I", operadores: 6, precio: 58, imagen: "https://images.unsplash.com/photo-1685504445355-0e7bdf90d415?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Cebolla4", variedad: "Mediana", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?q=80&w=400&auto=format&fit=crop" },
];
/*db*/
type Props = {
  especies: {
    id: number;
    nombreEspecie: string;
    especieActiva: boolean;
    uamId: number | null;
  }[];
};

export default function Inicio({ especies }: Props) {

  const especiesActivas = especies
  .filter((e) => e.especieActiva)
  .sort((a, b) => a.nombreEspecie.localeCompare(b.nombreEspecie, "es"));

  const productosPorPagina = 20;
  const [paginaActual, setPaginaActual] = useState(1);
  const totalPaginas = Math.ceil(productos.length / productosPorPagina);
  const indiceInicial = (paginaActual - 1) * productosPorPagina;
  const indiceFinal = indiceInicial + productosPorPagina;
  const productosPagina = productos.slice(indiceInicial, indiceFinal);

  return (
    <main className="bg-[var(--lightgray)] min-h-screen">

      <Header />

      <div className="grid grid-cols-1 lg:grid-cols-2 items-center">
        <div className="flex justify-center px-6 py-4 md:py-10">
          <h1 className="text-7xl md:text-8xl font-extrabold leading-none text-left pt-7 md:pt-10 text-[var(--ink)]">
            <span className="text-[var(--green)]">Mercado</span>
          <br />
            de hoy
          </h1>
        </div>

        <div className="relative flex flex-col items-center justify-center">
          {/* foto verduras */}
          <img
            src="https://elpueblodigital.uy/wp-content/uploads/2026/08/frutas-y-verduras-1024x768-png.webp"
            alt="Verduras frescas de feria"
            className="hidden lg:block w-full h-56 md:h-100 object-cover"
          />
          {/* Difuminado hacia el fondo */}
          <div className="absolute inset-0 hidden lg:block bg-gradient-to-l from-transparent via-transparent to-[var(--lightgray)]" />
           
          {/* logo sobre foto */}
          <div className="absolute top-15 left-1/2 -translate-x-1/2 z-10 h-70 w-50 overflow-hidden">
            <img
              src="https://uamservicios.uy/images/logo_white.png"
              alt="UAM"
              className="h-70 w-auto max-w-none hidden lg:block"
            />
          </div>
          {/* VER CUAL PREFIERO:
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-10 w-150 h-70 overflow-hidden">
              <img
                src="https://uam.com.uy/wp-content/uploads/2022/09/logo-uam.png"
                alt="UAM"
                className="w-150 h-auto hidden lg:block"
              />
            </div>*/}
        </div>

      </div>

      <div className="p-6 mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/productos" className="boton-inicio">Ver productos</Link>
          <Link href="/operadores" className="boton-inicio">Ver operadores</Link>
          <Link href="/lista-inteligente" className="boton-inicio">Lista inteligente</Link>
          <Link href="/precios" className="boton-inicio">Precios de referencia</Link>
        </div>
      </div>

      <section className="px-4 sm:px-8 pb-16">
        <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 tracking-tight">Productos</h2>

        <div className="flex flex-row items-center justify-between mb-2">
          <div className="flex items-center gap-2 mb-2">
            <button className="px-5 py-2 rounded-full bg-[var(--green)] text-white font-semibold text-sm">
              Todos
            </button>
            <button className="px-2 font-medium text-sm text-[var(--ink)]">
              Favoritos
            </button>
          </div>
          <span className="text-[10px] md:text-base font-bold text-gray-500 tracking-wide mb-1">
            {productos.length} PRODUCTOS PUBLICADOS
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
              className="w-full h-12 pl-11 pr-4 rounded-xl border border-gray-200/70 bg-white/70 text-[var(--ink)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--green)]"
            />
          </div>
          <button className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-xl border border-[var(--green)] text-[var(--green)]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M4 6h16M8 12h8M11 18h2" strokeLinecap="round" />
              <circle cx="14" cy="6" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="10" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="15" cy="18" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-3 ">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1 tracking-wide pl-1">ESPECIE</label>
            <select className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-800">
              <option value="">Todas las especies</option>
              {especiesActivas.map((e) => (
                <option key={e.id} value={e.nombreEspecie}>
                  {e.nombreEspecie}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 tracking-wide pl-2">...</label>
            <input type="number" min="0" placeholder="Mín" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 tracking-wide pl-2">...</label>
            <input type="number" min="0" placeholder="Máx" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400" />
          </div>
        </div>

        <div className="flex justify-end items-center gap-2 mb-5">
          <span className="text-xs font-bold text-gray-500 tracking-wide">ORDENAR POR:</span>
          <select className="text-sm font-bold text-[var(--green)] bg-transparent focus:outline-none">
            <option>...</option>
            <option>...</option>
            <option>...</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-5">
          {productosPagina.map((p) => (
            <ProductoCard
              key={p.nombre}
              nombre={p.nombre}
              variedad={p.variedad}
              categoria={p.categoria}
              operadores={p.operadores}
              imagen={p.imagen}
            />
          ))}
        </div>
        <div className="flex justify-center items-center gap-2 mt-8">
          <button
            onClick={() => setPaginaActual(paginaActual - 1)}
            disabled={paginaActual === 1}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>

          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((pagina) => (
            <button
              key={pagina}
              onClick={() => setPaginaActual(pagina)}
              className={`w-10 h-10 rounded-lg font-semibold ${
                paginaActual === pagina
                  ? "bg-[var(--green)] text-white"
                  : "bg-white border border-gray-300 text-[var(--ink)]"
              }`}
            >
              {pagina}
            </button>
          ))}

          <button
            onClick={() => setPaginaActual(paginaActual + 1)}
            disabled={paginaActual === totalPaginas}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente →
          </button>
        </div>
      </section>
    </main>
  );
}