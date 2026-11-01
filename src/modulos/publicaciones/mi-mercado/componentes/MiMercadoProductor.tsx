"use client";

import { useMemo, useState } from "react";
import YardOutlinedIcon from "@mui/icons-material/YardOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import { useRouter } from "next/navigation";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import EncabezadoPagina from "../../../../compartido/EncabezadoPagina";
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
    const { notificar } = useNotificacionToast();
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
        especie: publicacion.especie.nombreEspecie,
        variedad: publicacion.variedad?.nombreVariedad ?? "",
        presentacion: publicacion.presentacion?.nombrePresentacion ?? "",
        cantidadUnidades: publicacion.cantidadUnidades,
        categoria: publicacion.categoria?.nombreCategoria ?? "",
        calibre: publicacion.calibre?.nombreCalibre ?? "",
        codigoCalibre: publicacion.calibre?.codigoCalibre ?? "",
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
        <main className="relative isolate flex-1 bg-background">
            <div className="contenedor-pagina secciones-pagina relative z-10">
                <EncabezadoPagina
                    titulo="Mi Mercado"
                    subtitulo={`${publicaciones.length} ${publicaciones.length === 1 ? "publicación" : "publicaciones"}`}
                />
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
                    <EstadoVacio
                        titulo="No tenés publicaciones"
                        descripcion="Cuando tengas productos publicados aparecerán acá."
                        icono={<YardOutlinedIcon />}
                        nivelTitulo={2}
                        anunciar={false}
                    />
                ) : publicacionesVisibles.length === 0 ? (
                    <EstadoVacio
                        titulo="No hay publicaciones que coincidan con la búsqueda."
                        descripcion="Probá cambiando o limpiando los filtros para encontrar tus productos."
                        icono={<SearchOffOutlinedIcon />}
                        anunciar={false}
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-[var(--espacio-controles)] min-[701px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {publicacionesVisibles.map((publicacion) => (
                            <TarjetaPublicacionProductor key={publicacion.id} publicacion={publicacion} alConsultar={() => setSeleccionId(publicacion.id)} />
                        ))}
                    </div>
                )}
            </div>
            <DrawerPublicacionProductor publicacion={publicacionSeleccionada} alCerrar={() => setSeleccionId(null)} alGuardar={guardarPublicacion} alEliminada={(mensaje) => { notificar(mensaje, "success"); router.refresh(); }} />
            {productorId > 0 && <DrawerAltaPublicacionProductor productorId={productorId} abierto={altaAbierta} alCerrar={() => setAltaAbierta(false)} alCrear={(mensaje) => { setAltaAbierta(false); notificar(mensaje, "success"); router.refresh(); }} />}
        </main>
    );
}
