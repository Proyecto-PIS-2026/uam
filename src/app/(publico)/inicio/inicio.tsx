import ProductoCard from "./tarjetaProducto";
import Link from "next/link";

const productos = [
  { nombre: "Ananá", variedad: "Unidad", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Banana Cavendish", variedad: "Grande", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Berenjena", variedad: "Grande", categoria: "Categoría I", operadores: 1, precio: 4, imagen: "https://images.unsplash.com/photo-1576045212914-51a8d7e7eef3?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Brócoli", variedad: "Unidad", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1685504445355-0e7bdf90d415?q=80&w=400&auto=format&fit=crop" },
  { nombre: "Cebolla", variedad: "Mediana", categoria: "Categoría I", operadores: 1, precio: 58, imagen: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?q=80&w=400&auto=format&fit=crop" },
];

export default function Inicio() {
  return (
    <main className="bg-[#f5f4ef] min-h-screen">
      <div className="grid grid-cols-1 md:grid-cols-2 items-center">
        <div className="flex justify-center px-6 py-10">
          <h1 className="text-7xl md:text-8xl font-extrabold leading-none text-left">
            Mercado de
          <br />
            hoy
          </h1>
        </div>
        <img src="https://images.unsplash.com/photo-1619153422227-08d462800327?auto=format&fit=crop&w=1200&q=88" alt="Verduras frescas de feria" className="hidden md:block w-full h-56 md:h-80 object-cover"/>
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-3">
          <div className="flex items-center gap-2">
            <button className="px-5 py-2 rounded-full bg-emerald-700 text-white font-semibold text-sm">
              Todos
            </button>
            <button className="px-2 font-medium text-sm text-gray-700">
              Favoritos
            </button>
          </div>
          <span className="text-xs font-bold text-gray-500 tracking-wide">
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
              className="w-full h-12 pl-11 pr-4 rounded-xl border border-gray-200/70 bg-white/70 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <button className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-xl border border-emerald-700 text-emerald-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M4 6h16M8 12h8M11 18h2" strokeLinecap="round" />
              <circle cx="14" cy="6" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="10" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="15" cy="18" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 tracking-wide">GRUPO</label>
            <select className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-800">
              <option>Todos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 tracking-wide">ESPECIE</label>
            <select className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-800">
              <option>Todas</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 tracking-wide">PRECIO MÍN.</label>
            <input type="number" placeholder="Min" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 tracking-wide">PRECIO MÁX.</label>
            <input type="number" placeholder="Max" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400" />
          </div>
        </div>

        <div className="flex justify-end items-center gap-2 mb-5">
          <span className="text-xs font-bold text-gray-500 tracking-wide">ORDENAR POR</span>
          <select className="text-sm font-bold text-emerald-700 bg-transparent focus:outline-none">
            <option>Alfabéticamente</option>
            <option>Precio: menor a mayor</option>
            <option>Precio: mayor a menor</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-5">
          {productos.map((p) => (
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
      </section>
    </main>
  );
}