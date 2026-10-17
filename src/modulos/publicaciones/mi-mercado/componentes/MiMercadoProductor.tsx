"use client";

import { useMemo, useState } from "react";
import HojasDecorativas from "../../../../compartido/HojasDecorativas";
import { compararEspeciesPorPrioridad } from "../../../../compartido/prioridad-especies";
import type { PublicacionListado } from "../../../consulta-mercado/acciones/Publicaciones";
import FiltrosPublicaciones, { compararPublicacionesPorPrioridad, type OrdenPublicaciones } from "../../filtros/FiltrosPublicaciones";
import type { PublicacionMiMercadoProductor } from "../consultas-mi-mercado-productor";
import DrawerPublicacionProductor from "./DrawerPublicacionProductor";
import TarjetaPublicacionProductor from "./TarjetaPublicacionProductor";
import styles from "./MiMercado.module.css";

type Props = {
    publicaciones: PublicacionMiMercadoProductor[];
    nombreProductor?: string;
};

export default function MiMercadoProductor({ publicaciones, nombreProductor = "" }: Props) {
    const [agruparPorEspecie, setAgruparPorEspecie] = useState(true);
    const [ordenActual, setOrdenActual] = useState<OrdenPublicaciones>("prioridad");
    const [seleccionId, setSeleccionId] = useState<number | null>(null);
    const publicacionesParaFiltros = useMemo<PublicacionListado[]>(() => publicaciones.map((publicacion) => ({
        id: publicacion.id,
        precio: publicacion.precio === null ? null : Number(publicacion.precio),
        fecha: publicacion.fecha,
        foto: publicacion.foto,
        especie: publicacion.presentacion.variedad.especie.nombreEspecie,
        variedad: publicacion.presentacion.variedad.nombreVariedad,
        presentacion: publicacion.presentacion.nombrePresentacion,
        cantidadUnidades: publicacion.cantidadUnidades,
        categoria: publicacion.categoria.nombreCategoria,
        calibre: publicacion.calibre.nombreCalibre,
        codigoCalibre: publicacion.calibre.codigoCalibre,
        pais: publicacion.pais,
        operador: { id: 0, nombreFantasia: nombreProductor, whatsApp: "" },
    })), [publicaciones, nombreProductor]);
    const [publicacionesFiltradas, setPublicacionesFiltradas] = useState<PublicacionListado[]>(() => [...publicacionesParaFiltros].sort(compararPublicacionesPorPrioridad));
    const publicacionesPorId = new Map(publicaciones.map((publicacion) => [publicacion.id, publicacion]));
    const publicacionesVisibles = publicacionesFiltradas.flatMap((publicacion) => {
        const actual = publicacionesPorId.get(publicacion.id);
        return actual ? [actual] : [];
    });
    const publicacionSeleccionada = publicacionesPorId.get(seleccionId ?? -1) ?? null;
    const gruposPorEspecie = new Map<number, { nombre: string; publicaciones: PublicacionMiMercadoProductor[] }>();

    for (const publicacion of publicacionesVisibles) {
        const especie = publicacion.presentacion.variedad.especie;
        if (!gruposPorEspecie.has(especie.id)) {
            gruposPorEspecie.set(especie.id, { nombre: especie.nombreEspecie, publicaciones: [] });
        }
        gruposPorEspecie.get(especie.id)!.publicaciones.push(publicacion);
    }

    const grupos = Array.from(gruposPorEspecie.entries()).sort(([, primero], [, segundo]) => {
        if (ordenActual === "prioridad" || ordenActual === "precioAsc" || ordenActual === "precioDesc") {
            return compararEspeciesPorPrioridad(primero.nombre, segundo.nombre);
        }
        const comparacion = primero.nombre.localeCompare(segundo.nombre, "es", { sensitivity: "base" });
        return ordenActual === "alfabeticoDesc" ? -comparacion : comparacion;
    });

    function tarjetas(items: PublicacionMiMercadoProductor[]) {
        return (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {items.map((publicacion) => (
                    <TarjetaPublicacionProductor key={publicacion.id} publicacion={publicacion} alConsultar={() => setSeleccionId(publicacion.id)} />
                ))}
            </div>
        );
    }

    return (
        <main className="relative isolate min-h-screen bg-background">
            <div className="contenedor-pagina relative z-10 flex flex-col gap-6">
                <header className="encabezado-pagina relative isolate overflow-hidden rounded-2xl bg-secondary">
                    <HojasDecorativas />
                    <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary-soft">Mis publicaciones</p>
                            <h1 className="titulo-pagina text-white">Mi Mercado</h1>
                            <p className="mt-2 text-sm text-white/80 sm:text-base">Consultá los productos que tenés publicados.</p>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                            <button type="button" disabled title="Próximamente" className="rounded-lg bg-surface px-4 py-3 text-sm font-semibold text-secondary disabled:cursor-not-allowed disabled:opacity-60">Nueva publicación</button>
                            <p className="text-sm font-semibold text-white/80">{publicaciones.length} {publicaciones.length === 1 ? "publicación" : "publicaciones"}</p>
                        </div>
                    </div>
                </header>
                {publicaciones.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
                        <h2 className="text-xl font-bold text-foreground">No tenés publicaciones</h2>
                        <p className="mt-2 text-sm text-muted">Cuando tengas productos publicados aparecerán acá.</p>
                    </div>
                ) : (
                    <>
                        <div className={styles.filtros}>
                            <FiltrosPublicaciones publicaciones={publicacionesParaFiltros} especieFiltro="" ordenInicial="prioridad" alFiltrar={setPublicacionesFiltradas} alCambiarOrden={setOrdenActual} />
                        </div>
                        <div className={styles.encabezadoCatalogo}>
                            <h2 className={styles.titulo}>Publicaciones</h2>
                            <button type="button" aria-pressed={agruparPorEspecie} onClick={() => setAgruparPorEspecie((actual) => !actual)} className={`${styles.botonAgrupar} ${agruparPorEspecie ? styles.botonAgruparActivo : ""}`}>
                                {agruparPorEspecie ? "Desagrupar" : "Agrupar por especie"}
                            </button>
                        </div>
                        {publicacionesVisibles.length === 0 ? (
                            <p className={styles.sinResultados}>No hay publicaciones que coincidan con la búsqueda.</p>
                        ) : agruparPorEspecie ? (
                            <div className="space-y-6">
                                {grupos.map(([id, grupo]) => (
                                    <section key={id}>
                                        <div className="mb-6 flex items-center gap-2 border-b border-border pb-2">
                                            <h3 className="text-xl font-bold text-foreground">{grupo.nombre}</h3>
                                            <span className="text-sm text-muted">· {grupo.publicaciones.length} {grupo.publicaciones.length === 1 ? "publicación" : "publicaciones"}</span>
                                        </div>
                                        {tarjetas(grupo.publicaciones)}
                                    </section>
                                ))}
                            </div>
                        ) : tarjetas(publicacionesVisibles)}
                    </>
                )}
            </div>
            <DrawerPublicacionProductor publicacion={publicacionSeleccionada} alCerrar={() => setSeleccionId(null)} />
        </main>
    );
}
