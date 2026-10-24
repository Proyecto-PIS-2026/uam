"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HojasDecorativas from "../../../../compartido/HojasDecorativas";
import type { PublicacionListado } from "../../../consulta-mercado/acciones/PublicacionesOperador";
import FiltrosPublicaciones, { compararPublicacionesPorPrioridad } from "../../filtros/FiltrosPublicaciones";
import type { PublicacionMiMercadoProductor } from "../consultas-mi-mercado-productor";
import DrawerPublicacionProductor from "./DrawerPublicacionProductor";
import { DrawerAltaPublicacionProductor } from "../../productores/AltaPublicacionProductor";
import TarjetaPublicacionProductor from "./TarjetaPublicacionProductor";
import styles from "./MiMercado.module.css";

const obtenerNombreOperador = (publicacion: PublicacionListado) => publicacion.operador.nombreFantasia;

type Props = {
    publicaciones: PublicacionMiMercadoProductor[];
    nombreProductor?: string;
    productorId?: number;
};

export default function MiMercadoProductor({ publicaciones, nombreProductor = "", productorId = 0 }: Props) {
    const router = useRouter();
    const [mensaje, setMensaje] = useState("");
    const [seleccionId, setSeleccionId] = useState<number | null>(null);
    const [altaAbierta, setAltaAbierta] = useState(false);
    const [cambiosGuardados, setCambiosGuardados] = useState<{ origen: PublicacionMiMercadoProductor[]; porId: Map<number, PublicacionMiMercadoProductor> } | null>(null);
    const publicacionesActuales = useMemo(() => publicaciones.map((publicacion) =>
        cambiosGuardados?.origen === publicaciones ? cambiosGuardados.porId.get(publicacion.id) ?? publicacion : publicacion,
    ), [publicaciones, cambiosGuardados]);
    const publicacionesParaFiltros = useMemo<PublicacionListado[]>(() => publicacionesActuales.map((publicacion) => ({
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
        tipoPublicacion: "OPERADOR",
    })), [publicacionesActuales, nombreProductor]);
    const [publicacionesFiltradas, setPublicacionesFiltradas] = useState<PublicacionListado[]>(() => [...publicacionesParaFiltros].sort(compararPublicacionesPorPrioridad));
    const publicacionesPorId = new Map(publicacionesActuales.map((publicacion) => [publicacion.id, publicacion]));
    const publicacionesVisibles = publicacionesFiltradas.flatMap((publicacion) => {
        const actual = publicacionesPorId.get(publicacion.id);
        return actual ? [actual] : [];
    });
    const publicacionSeleccionada = publicacionesPorId.get(seleccionId ?? -1) ?? null;

    function guardarPublicacion(publicacion: PublicacionMiMercadoProductor) {
        setCambiosGuardados((actual) => ({
            origen: publicaciones,
            porId: new Map(actual?.origen === publicaciones ? actual.porId : []).set(publicacion.id, publicacion),
        }));
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
                        <p className="text-sm font-semibold text-white/80">{publicaciones.length} {publicaciones.length === 1 ? "publicación" : "publicaciones"}</p>
                    </div>
                </header>
                {mensaje && <p className="rounded-lg bg-primary-soft p-4 text-sm text-secondary" role="status">{mensaje}</p>}
                {publicaciones.length > 0 && (
                    <div className={styles.filtros}>
                        <FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesParaFiltros} especieFiltro="" ordenInicial="prioridad" alFiltrar={setPublicacionesFiltradas} />
                    </div>
                )}
                <div className={`${styles.encabezadoCatalogo} flex-wrap`}>
                    <h2 className={styles.titulo}>Publicaciones</h2>
                    <button type="button" onClick={() => setAltaAbierta(true)} disabled={!productorId} className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">Nueva publicación</button>
                </div>
                {publicaciones.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
                        <h2 className="text-xl font-bold text-foreground">No tenés publicaciones</h2>
                        <p className="mt-2 text-sm text-muted">Cuando tengas productos publicados aparecerán acá.</p>
                    </div>
                ) : publicacionesVisibles.length === 0 ? (
                    <p className={styles.sinResultados}>No hay publicaciones que coincidan con la búsqueda.</p>
                ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {publicacionesVisibles.map((publicacion) => (
                            <TarjetaPublicacionProductor key={publicacion.id} publicacion={publicacion} alConsultar={() => setSeleccionId(publicacion.id)} />
                        ))}
                    </div>
                )}
            </div>
            <DrawerPublicacionProductor publicacion={publicacionSeleccionada} alCerrar={() => setSeleccionId(null)} alGuardar={guardarPublicacion} alEliminada={(aviso) => { setMensaje(aviso); router.refresh(); }} />
            {productorId > 0 && <DrawerAltaPublicacionProductor productorId={productorId} abierto={altaAbierta} alCerrar={() => setAltaAbierta(false)} alCrear={() => setAltaAbierta(false)} />}
        </main>
    );
}
