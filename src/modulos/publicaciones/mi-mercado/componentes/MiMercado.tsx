"use client";

import { useMemo, useRef, useState } from "react";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import NotificacionToast, { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import { useRouter } from "next/navigation";
import EncabezadoPagina from "../../../../compartido/EncabezadoPagina";
import { ConfirmModal } from "../../../../compartido/componentes/ConfirmModal";
import DrawerEditarPublicacion from "../../operadores/componentes/DrawerEditarPublicacion";
import type { Publicacion } from "../tipos";
import type { PublicacionParaEditar, OpcionesEdicionPublicacion, CambiosPublicacionOperador } from "../../operadores/tipos";
import NuevaPublicacion from "../../operadores/componentes/NuevaPublicacion";
import FiltrosPublicaciones, { compararPublicacionesPorPrioridad } from "../../filtros/FiltrosPublicaciones";
import type { PublicacionListado } from "../../../consulta-mercado/acciones/PublicacionesOperador";
import TarjetaPublicacion from "./TarjetaPublicacion";
import { cargarPublicacionesMiMercado } from "../acciones";
import { useActualizacionesPublicaciones } from "../../tiempo-real/use-actualizaciones-publicaciones";
import styles from "./MiMercado.module.css";
import { useCompartirPublicacion } from "../use-compartir-publicacion";

const obtenerNombreOperador = (publicacion: PublicacionListado) => publicacion.operador.nombreFantasia;

type Props = {
    operadorId: number;
    nombreOperador?: string;
    abrirAltaInicial?: boolean;
    puedeCrear: boolean;
    puedeModificar: boolean;
    puedeEliminar: boolean;
    publicaciones: Publicacion[];
    incrementoPrecio: number;
    opcionesEdicion: OpcionesEdicionPublicacion;
};

export default function MiMercado({ operadorId, nombreOperador = "", abrirAltaInicial = false, puedeCrear, puedeModificar, puedeEliminar, publicaciones, incrementoPrecio, opcionesEdicion }: Props) {
    const router = useRouter();
    const [altaAbierta, setAltaAbierta] = useState(abrirAltaInicial && puedeCrear);
    const [seleccion, setSeleccion] = useState<{ publicacion: Publicacion; listado: Publicacion[] } | null>(null);
    const [listadoRecargado, setListadoRecargado] = useState<{ origen: Publicacion[]; datos: Publicacion[] } | null>(null);
    const [sincronizando, setSincronizando] = useState(false);
    const ultimaRecarga = useRef(0);
    const [publicacionPendiente, setPublicacionPendiente] = useState<Publicacion | null>(null);
    const [eliminando, setEliminando] = useState(false);
    const [error, setError] = useState("");
    const { notificacion, notificar, cerrarNotificacion } = useNotificacionToast();
    const [idsEliminados, setIdsEliminados] = useState<number[]>([]);
    const publicacionesActuales = listadoRecargado?.origen === publicaciones ? listadoRecargado.datos : publicaciones;
    const publicacionesVigentes = useMemo(() => publicacionesActuales.filter((publicacion) => !idsEliminados.includes(publicacion.id)), [publicacionesActuales, idsEliminados]);
    const publicacionesParaFiltros = useMemo<PublicacionListado[]>(() => publicacionesVigentes.map((publicacion) => ({
        id: publicacion.id,
        precio: publicacion.precio === null ? null : Number(publicacion.precio),
        fecha: publicacion.fecha,
        foto: publicacion.foto,
        especie: publicacion.especie.nombreEspecie,
        variedad: publicacion.variedad?.nombreVariedad ?? "",
        presentacion: publicacion.presentacion?.nombrePresentacion ?? "",
        cantidadUnidades: publicacion.cantidadUnidades === null ? null : Number(publicacion.cantidadUnidades),
        categoria: publicacion.categoria?.nombreCategoria ?? "",
        calibre: publicacion.calibre?.nombreCalibre ?? "",
        codigoCalibre: publicacion.calibre?.codigoCalibre ?? "",
        pais: "",
        tipoPublicacion: "OPERADOR",
        operador: { id: operadorId, nombreFantasia: nombreOperador, whatsApp: "" },
    })), [publicacionesVigentes, operadorId, nombreOperador]);
    const [publicacionesFiltradas, setPublicacionesFiltradas] = useState<PublicacionListado[]>(() => [...publicacionesParaFiltros].sort(compararPublicacionesPorPrioridad));
    const publicacionesPorId = new Map(publicacionesVigentes.map((publicacion) => [publicacion.id, publicacion]));
    const publicacionesVisibles: Publicacion[] = [];
    for (const publicacionFiltrada of publicacionesFiltradas) {
        const publicacion = publicacionesPorId.get(publicacionFiltrada.id);
        if (publicacion) publicacionesVisibles.push(publicacion);
    }

    let publicacionSeleccionada = seleccion?.publicacion ?? null;
    if (seleccion && seleccion.listado !== publicacionesActuales) {
        publicacionSeleccionada = publicacionesActuales.find((publicacion) => publicacion.id === seleccion.publicacion.id) ?? null;
    }
    const { compartir, preparandoFoto, compartiendo } = useCompartirPublicacion(publicacionSeleccionada, nombreOperador, notificar);

    const publicacionParaEditar: PublicacionParaEditar | null = publicacionSeleccionada ? {
        publicacionOperadorId: publicacionSeleccionada.publicacionOperadorId,
        publicacionId: publicacionSeleccionada.id,
        especieId: publicacionSeleccionada.especie.id,
        variedadId: publicacionSeleccionada.variedad?.id ?? null,
        especie: publicacionSeleccionada.especie.nombreEspecie,
        variedad: publicacionSeleccionada.variedad?.nombreVariedad ?? "",
        presentacion: publicacionSeleccionada.presentacion?.nombrePresentacion ?? "",
        cantidadUnidades: publicacionSeleccionada.cantidadUnidades,
        categoria: publicacionSeleccionada.categoria?.nombreCategoria ?? "",
        calibre: publicacionSeleccionada.calibre?.nombreCalibre ?? "",
        precio: publicacionSeleccionada.precio,
        foto: publicacionSeleccionada.foto,
        fecha: publicacionSeleccionada.fecha,
        version: publicacionSeleccionada.version,
        categoriaId: publicacionSeleccionada.categoria?.id ?? null,
        calibreId: publicacionSeleccionada.calibre?.id ?? null,
        presentacionId: publicacionSeleccionada.presentacion?.id ?? null,
        paisId: publicacionSeleccionada.paisId,
        disponible: publicacionSeleccionada.publicacionDisponible,
    } : null;

    function abrirAlta() {
        setError("");
        cerrarNotificacion();
        setAltaAbierta(true);
    }

    function cerrarAlta() {
        setAltaAbierta(false);
        if (abrirAltaInicial) router.replace("/mi-mercado", { scroll: false });
    }

    useActualizacionesPublicaciones(() => sincronizarPublicaciones(), operadorId);

    async function sincronizarPublicaciones() {
        const recarga = ++ultimaRecarga.current;
        setSincronizando(true);
        setError("");
        try {
            const datos = await cargarPublicacionesMiMercado(operadorId);
            if (recarga !== ultimaRecarga.current) return false;
            setListadoRecargado((anterior) => {
                const vigentes = anterior?.origen === publicaciones ? anterior.datos : publicaciones;
                const porId = new Map(vigentes.map((publicacion) => [publicacion.id, publicacion]));
                return { origen: publicaciones, datos: datos.map((publicacion) => {
                    const vigente = porId.get(publicacion.id);
                    return vigente && vigente.version > publicacion.version ? vigente : publicacion;
                }) };
            });
            setIdsEliminados((actuales) => actuales.filter((id) => datos.some((publicacion) => publicacion.id === id)));
            setSeleccion((actual) => actual && datos.some((publicacion) => publicacion.id === actual.publicacion.id) ? actual : null);
            setPublicacionPendiente((actual) => actual && datos.some((publicacion) => publicacion.id === actual.id) ? actual : null);
            return datos;
        } catch {
            if (recarga !== ultimaRecarga.current) return false;
            cerrarNotificacion();
            setError("No se pudo actualizar el listado. Recargá la página.");
            return false;
        } finally {
            if (recarga === ultimaRecarga.current) setSincronizando(false);
        }
    }

    function publicacionCreada(aviso: string) {
        cerrarAlta();
        void sincronizarPublicaciones().then((actualizado) => {
            if (actualizado) notificar(aviso, "success");
        });
    }

    function consultarPublicacion(publicacion: Publicacion) {
        setError("");
        cerrarNotificacion();
        setSeleccion({ publicacion, listado: publicacionesActuales });
    }

    function solicitarBaja(publicacion: Publicacion) {
        setError("");
        cerrarNotificacion();
        setPublicacionPendiente(publicacion);
    }

    async function guardarCambios(publicacionOperadorId: number, cambios: CambiosPublicacionOperador, fotoNueva: File | null) {
        if (!publicacionSeleccionada || publicacionSeleccionada.publicacionOperadorId !== publicacionOperadorId) {
            throw new Error("La publicación seleccionada cambió.");
        }
        setError("");

        const formulario = new FormData();
        formulario.set("cambios", JSON.stringify(cambios));
        if (fotoNueva) formulario.set("fotografia", fotoNueva);

        const respuesta = await fetch(`/api/publicaciones/${publicacionSeleccionada.id}?operadorId=${operadorId}`, { method: "PATCH", body: formulario });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            if (respuesta.status === 404) {
                const datos = await sincronizarPublicaciones();
                if (datos && !datos.some((publicacion) => publicacion.id === publicacionSeleccionada.id)) {
                    notificar("La publicación ya no está disponible. Se actualizó el listado.", "info");
                    return;
                }
            }
            if (respuesta.status === 409) await sincronizarPublicaciones();
            throw new Error(resultado.errores?.[0] ?? "No se pudieron guardar los cambios.");
        }

        const datos = await sincronizarPublicaciones();
        if (datos) {
            const sigueDisponible = datos.some((publicacion) => publicacion.id === publicacionSeleccionada.id);
            notificar(sigueDisponible ? resultado.mensaje ?? "Publicación actualizada." : "La publicación ya no está disponible. Se actualizó el listado.", sigueDisponible ? "success" : "info");
        }
    }

    async function eliminarPublicacion() {
        if (!publicacionPendiente || eliminando) return;
        const publicacion = publicacionPendiente;
        setEliminando(true);
        setError("");
        try {
            const respuesta = await fetch(`/api/publicaciones/${publicacion.id}?operadorId=${operadorId}`, { method: "DELETE" });
            const resultado = await respuesta.json();
            if (!respuesta.ok) {
                if (respuesta.status === 404) {
                    const datos = await sincronizarPublicaciones();
                    if (datos && !datos.some((actual) => actual.id === publicacion.id)) {
                        setPublicacionPendiente(null);
                        setSeleccion((actual) => actual?.publicacion.id === publicacion.id ? null : actual);
                        notificar("La publicación ya había sido eliminada. Se actualizó el listado.", "info");
                        return;
                    }
                }
                throw new Error(resultado.errores?.[0] ?? "No se pudo eliminar la publicación.");
            }

            setIdsEliminados((actuales) => [...actuales, publicacion.id]);
            setPublicacionPendiente(null);
            setSeleccion((actual) => actual?.publicacion.id === publicacion.id ? null : actual);
            if (await sincronizarPublicaciones()) {
                notificar(resultado.mensaje ?? "Publicación eliminada.", "success");
            }
        } catch (error) {
            notificar(error instanceof Error ? error.message : "No se pudo conectar con el servidor.", "error");
            setPublicacionPendiente(null);
        } finally {
            setEliminando(false);
        }
    }

    function actualizarPrecioLocal(publicacionId: number, nuevoPrecio: number | null, fecha?: string, version?: number) {
        setListadoRecargado((actual) => {
            const datosActuales = actual?.origen === publicaciones ? actual.datos : publicaciones;
            return {
                origen: publicaciones,
                datos: datosActuales.map((publicacion) => publicacion.id === publicacionId && (version === undefined || version >= publicacion.version) ? { ...publicacion, precio: nuevoPrecio === null ? null : String(nuevoPrecio), fecha: fecha ?? publicacion.fecha, version: version ?? publicacion.version } : publicacion),
            };
        });
    }

    return (
        <main className="relative isolate flex-1 bg-background">
            <div className="contenedor-pagina secciones-pagina relative z-10">

                {/* Encabezado */}
                <EncabezadoPagina
                    titulo="Mi Mercado"
                    subtitulo={`${publicacionesVigentes.length} ${publicacionesVigentes.length === 1 ? "publicación" : "publicaciones"}`}
                />

                {error && <p className={styles.mensajeError} role="alert">{error}</p>}

                {publicacionesVigentes.length > 0 && (
                    <div className={styles.filtros}>
                        <FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesParaFiltros} especieFiltro="" ordenInicial="prioridad" alFiltrar={setPublicacionesFiltradas} />
                    </div>
                )}
                <div className={`${styles.encabezadoCatalogo} flex-wrap`}>
                    <h2 className={styles.titulo}>Publicaciones</h2>
                    {puedeCrear && <button type="button" onClick={abrirAlta} className="boton-primario">Nueva publicación</button>}
                </div>

                {publicacionesVigentes.length === 0 ? (
                    <EstadoVacio
                        titulo="No tenés publicaciones"
                        descripcion="Cuando tengas productos publicados aparecerán acá."
                        icono={<Inventory2OutlinedIcon />}
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
                    <div className="grid grid-cols-1 gap-[var(--espacio-controles)] md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 tarjetas-compactas-mercado">
                        {publicacionesVisibles.map((pub) => (
                            <TarjetaPublicacion
                                key={pub.id}
                                pub={pub}
                                operadorId={operadorId}
                                puedeModificar={puedeModificar}
                                incrementoPrecio={incrementoPrecio}
                                alConsultar={consultarPublicacion}
                                alPrecioActualizado={actualizarPrecioLocal}
                                alPublicacionEliminada={() => void sincronizarPublicaciones()}
                            />
                        ))}
                    </div>
                )}
            </div>
            {puedeCrear && altaAbierta && <NuevaPublicacion operadorId={operadorId} incrementoPrecio={incrementoPrecio} abierto={altaAbierta} alCerrar={cerrarAlta} alCrear={publicacionCreada} />}
            <DrawerEditarPublicacion incrementoPrecio={incrementoPrecio} abierto={publicacionSeleccionada !== null} alCerrar={() => setSeleccion(null)} alGuardar={guardarCambios} publicacion={publicacionParaEditar} modoInicial="consulta" puedeModificar={puedeModificar} puedeEliminar={puedeEliminar} alEliminar={() => { if (publicacionSeleccionada) solicitarBaja(publicacionSeleccionada); }}
            alCompartir={() => { cerrarNotificacion(); void compartir(); }}
            compartiendo={compartiendo || preparandoFoto}
            eliminando={eliminando} actualizando={sincronizando} errorConsulta={error} {...opcionesEdicion}>

                <ConfirmModal abierto={publicacionPendiente !== null} titulo="Eliminar publicación" descripcion={publicacionPendiente ? `¿Querés eliminar la publicación de ${publicacionPendiente.especie.nombreEspecie}? Esta acción no se puede deshacer.` : ""} textoConfirmar="Sí, eliminar" procesando={eliminando} alCancelar={() => { if (!eliminando) setPublicacionPendiente(null); }} alConfirmar={() => void eliminarPublicacion()} />

            </DrawerEditarPublicacion>
            <NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} />
        </main>
    );
}
