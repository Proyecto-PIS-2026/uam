"use client";

import { useMemo, useState } from "react";
import NotificacionToast, { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
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
    const { notificacion, notificar, cerrarNotificacion } = useNotificacionToast();
    const [seleccionId, setSeleccionId] = useState<number | null>(null);
    const [altaAbierta, setAltaAbierta] = useState(false);
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
        tipoPublicacion: "OPERADOR",
    })), [publicaciones, nombreProductor]);
    const [publicacionesFiltradas, setPublicacionesFiltradas] = useState<PublicacionListado[]>(() => [...publicacionesParaFiltros].sort(compararPublicacionesPorPrioridad));
    const publicacionesPorId = new Map(publicaciones.map((publicacion) => [publicacion.id, publicacion]));
    const publicacionesVisibles = publicacionesFiltradas.flatMap((publicacion) => {
        const actual = publicacionesPorId.get(publicacion.id);
        return actual ? [actual] : [];
    });
    const publicacionSeleccionada = publicacionesPorId.get(seleccionId ?? -1) ?? null;

    return (
        <main className="relative isolate flex-1 bg-background">
            <div className="contenedor-pagina secciones-pagina relative z-10">
                <header className="encabezado-pagina relative isolate overflow-hidden">
                    <HojasDecorativas />
                    <div className="relative z-10 flex flex-col gap-[var(--espacio-controles)] sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="mb-[var(--espacio-textos)] text-[length:var(--tamano-texto-auxiliar)] font-bold uppercase tracking-widest text-[var(--color-subtitulo-pagina)]">Mis publicaciones</p>
                            <h1 className="titulo-pagina">Mi Mercado</h1>
                            <p className="subtitulo-pagina mt-[var(--espacio-textos)]">Consultá los productos que tenés publicados.</p>
                        </div>
                        <p className="subtitulo-pagina">{publicaciones.length} {publicaciones.length === 1 ? "publicación" : "publicaciones"}</p>
                    </div>
                </header>
                {publicaciones.length > 0 && (
                    <div className={styles.filtros}>
                        <FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesParaFiltros} especieFiltro="" ordenInicial="prioridad" alFiltrar={setPublicacionesFiltradas} />
                    </div>
                )}
                <div className={`${styles.encabezadoCatalogo} flex-wrap`}>
                    <h2 className={styles.titulo}>Publicaciones</h2>
                    <button type="button" onClick={() => setAltaAbierta(true)} disabled={!productorId} className="boton-primario">Nueva publicación</button>
                </div>
                {publicaciones.length === 0 ? (
                    <div className={styles.estadoVacio}>
                        <h2 className={styles.tituloVacio}>No tenés publicaciones</h2>
                        <p className={styles.descripcionVacio}>Cuando tengas productos publicados aparecerán acá.</p>
                    </div>
                ) : publicacionesVisibles.length === 0 ? (
                    <p className={styles.sinResultados}>No hay publicaciones que coincidan con la búsqueda.</p>
                ) : (
                    <div className="grid grid-cols-1 gap-[var(--espacio-controles)] md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {publicacionesVisibles.map((publicacion) => (
                            <TarjetaPublicacionProductor key={publicacion.id} publicacion={publicacion} alConsultar={() => setSeleccionId(publicacion.id)} />
                        ))}
                    </div>
                )}
            </div>
            <DrawerPublicacionProductor publicacion={publicacionSeleccionada} alCerrar={() => setSeleccionId(null)} />
            {productorId > 0 && <DrawerAltaPublicacionProductor productorId={productorId} abierto={altaAbierta} alCerrar={() => setAltaAbierta(false)} alCrear={(mensaje) => { setAltaAbierta(false); notificar(mensaje, "success"); }} />}
            <NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} />
        </main>
    );
}
