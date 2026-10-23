"use client";

import { useMemo, useRef, useState } from "react";
import NotificacionToast, { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import { useRouter } from "next/navigation";
import HojasDecorativas from "../../../../compartido/HojasDecorativas";
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
import CompartirEstadoWhatsApp from "./CompartirEstadoWhatsApp";

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
    const [publicacionACompartir, setPublicacionACompartir] = useState<Publicacion | null>(null);
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
        especie: publicacion.presentacion.variedad.especie.nombreEspecie,
        variedad: publicacion.presentacion.variedad.nombreVariedad,
        presentacion: publicacion.presentacion.nombrePresentacion,
        cantidadUnidades: publicacion.cantidadUnidades === null ? null : Number(publicacion.cantidadUnidades),
        categoria: publicacion.categoria.nombreCategoria,
        calibre: publicacion.calibre.nombreCalibre,
        codigoCalibre: publicacion.calibre.codigoCalibre,
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

    const publicacionParaEditar: PublicacionParaEditar | null = publicacionSeleccionada ? {
        publicacionOperadorId: publicacionSeleccionada.publicacionOperadorId,
        publicacionId: publicacionSeleccionada.id,
        especieId: publicacionSeleccionada.presentacion.variedad.especie.id,
        variedadId: publicacionSeleccionada.presentacion.variedad.id,
        especie: publicacionSeleccionada.presentacion.variedad.especie.nombreEspecie,
        variedad: publicacionSeleccionada.presentacion.variedad.nombreVariedad,
        presentacion: publicacionSeleccionada.presentacion.nombrePresentacion,
        cantidadUnidades: publicacionSeleccionada.cantidadUnidades,
        categoria: publicacionSeleccionada.categoria.nombreCategoria,
        calibre: publicacionSeleccionada.calibre.nombreCalibre,
        precio: publicacionSeleccionada.precio,
        foto: publicacionSeleccionada.foto,
        fecha: publicacionSeleccionada.fecha,
        version: publicacionSeleccionada.version,
        categoriaId: publicacionSeleccionada.categoria.id,
        calibreId: publicacionSeleccionada.calibre.id,
        presentacionId: publicacionSeleccionada.presentacion.id,
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

    function actualizarPrecioLocal(publicacionId: number, nuevoPrecio: number, fecha?: string, version?: number) {
        setListadoRecargado((actual) => {
            const datosActuales = actual?.origen === publicaciones ? actual.datos : publicaciones;
            return {
                origen: publicaciones,
                datos: datosActuales.map((publicacion) => publicacion.id === publicacionId && (version === undefined || version >= publicacion.version) ? { ...publicacion, precio: String(nuevoPrecio), fecha: fecha ?? publicacion.fecha, version: version ?? publicacion.version } : publicacion),
            };
        });
    }

    return (
        <main className="relative isolate flex-1 bg-background">
            <div className="contenedor-pagina secciones-pagina relative z-10">

                {/* Encabezado */}
                <header className="encabezado-pagina relative isolate overflow-hidden">
                    <HojasDecorativas />
                    <div className="relative z-10 flex flex-col gap-[var(--espacio-controles)] sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="mb-[var(--espacio-textos)] text-[length:var(--tamano-texto-auxiliar)] font-bold uppercase tracking-widest text-[var(--color-subtitulo-pagina)]">
                                Mis publicaciones
                            </p>

                            <h1 className="titulo-pagina">
                                Mi Mercado
                            </h1>

                            <p className="subtitulo-pagina mt-[var(--espacio-textos)]">
                                Consultá los productos que tenés publicados.
                            </p>
                        </div>

                        <p className="subtitulo-pagina">
                            {publicacionesVigentes.length}{" "}{publicacionesVigentes.length === 1 ? "publicación" : "publicaciones"}
                        </p>
                    </div>
                </header>

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

                {/* Estado vacío */}
                {publicacionesVigentes.length === 0 ? (
                    <div className={styles.estadoVacio}>
                        <h2 className={styles.tituloVacio}>
                            No tenés publicaciones
                        </h2>

                        <p className={styles.descripcionVacio}>
                            Cuando tengas productos publicados aparecerán acá.
                        </p>
                    </div>
                ) : publicacionesVisibles.length === 0 ? (
                    <p className={styles.sinResultados}>No hay publicaciones que coincidan con la búsqueda.</p>
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
            alCompartir={() => {
                if (publicacionSeleccionada) {
                    setPublicacionACompartir(publicacionSeleccionada);
                    setSeleccion(null);
                }
            }}
            eliminando={eliminando} actualizando={sincronizando} errorConsulta={error} {...opcionesEdicion}>

                <ConfirmModal abierto={publicacionPendiente !== null} titulo="Eliminar publicación" descripcion={publicacionPendiente ? `¿Querés eliminar la publicación de ${publicacionPendiente.presentacion.variedad.especie.nombreEspecie}? Esta acción no se puede deshacer.` : ""} textoConfirmar="Sí, eliminar" procesando={eliminando} alCancelar={() => { if (!eliminando) setPublicacionPendiente(null); }} alConfirmar={() => void eliminarPublicacion()} />

                </DrawerEditarPublicacion>
                {publicacionACompartir && (
                    <CompartirEstadoWhatsApp
                        publicacion={publicacionACompartir}
                        nombreOperador={nombreOperador}
                        alCerrar={() => setPublicacionACompartir(null)}
                    />
                )}
            <NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} />
        </main>
    );
}
