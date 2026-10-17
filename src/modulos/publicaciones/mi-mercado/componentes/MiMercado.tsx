"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import HojasDecorativas from "../../../../compartido/HojasDecorativas";
import { ConfirmModal } from "../../../../compartido/componentes/ConfirmModal";
import { compararEspeciesPorPrioridad } from "../../../../compartido/prioridad-especies";
import DrawerEditarPublicacion from "../../operadores/componentes/DrawerEditarPublicacion";
import type { Publicacion } from "../tipos";
import type { PublicacionParaEditar, OpcionesEdicionPublicacion, CambiosPublicacionOperador } from "../../operadores/tipos";
import NuevaPublicacion from "../../operadores/componentes/NuevaPublicacion";
import FiltrosPublicaciones, { compararPublicacionesPorPrioridad, type OrdenPublicaciones } from "../../filtros/FiltrosPublicaciones";
import type { PublicacionListado } from "../../../consulta-mercado/acciones/Publicaciones";
import TarjetaPublicacion from "./TarjetaPublicacion";
import { cargarPublicacionesMiMercado } from "../acciones";
import { useActualizacionesPublicaciones } from "../../tiempo-real/use-actualizaciones-publicaciones";
import styles from "./MiMercado.module.css";

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
    const [agruparPorEspecie, setAgruparPorEspecie] = useState(true);
    const [ordenActual, setOrdenActual] = useState<OrdenPublicaciones>("prioridad");
    const [seleccion, setSeleccion] = useState<{ publicacion: Publicacion; listado: Publicacion[] } | null>(null);
    const [listadoRecargado, setListadoRecargado] = useState<{ origen: Publicacion[]; datos: Publicacion[] } | null>(null);
    const [sincronizando, setSincronizando] = useState(false);
    const ultimaRecarga = useRef(0);
    const [publicacionPendiente, setPublicacionPendiente] = useState<Publicacion | null>(null);
    const [eliminando, setEliminando] = useState(false);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
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
        setMensaje("");
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
            setMensaje("");
            setError("No se pudo actualizar el listado. Recargá la página.");
            return false;
        } finally {
            if (recarga === ultimaRecarga.current) setSincronizando(false);
        }
    }

    function publicacionCreada(aviso: string) {
        cerrarAlta();
        void sincronizarPublicaciones().then((actualizado) => {
            if (actualizado) setMensaje(aviso);
        });
    }

    function consultarPublicacion(publicacion: Publicacion) {
        setError("");
        setMensaje("");
        setSeleccion({ publicacion, listado: publicacionesActuales });
    }

    function solicitarBaja(publicacion: Publicacion) {
        setError("");
        setMensaje("");
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
                    setMensaje("La publicación ya no está disponible. Se actualizó el listado.");
                    return;
                }
            }
            if (respuesta.status === 409) await sincronizarPublicaciones();
            throw new Error(resultado.errores?.[0] ?? "No se pudieron guardar los cambios.");
        }

        const datos = await sincronizarPublicaciones();
        if (datos) {
            const sigueDisponible = datos.some((publicacion) => publicacion.id === publicacionSeleccionada.id);
            setMensaje(sigueDisponible ? resultado.mensaje ?? "Publicación actualizada." : "La publicación ya no está disponible. Se actualizó el listado.");
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
                        setMensaje("La publicación ya había sido eliminada. Se actualizó el listado.");
                        return;
                    }
                }
                throw new Error(resultado.errores?.[0] ?? "No se pudo eliminar la publicación.");
            }

            setIdsEliminados((actuales) => [...actuales, publicacion.id]);
            setPublicacionPendiente(null);
            setSeleccion((actual) => actual?.publicacion.id === publicacion.id ? null : actual);
            if (await sincronizarPublicaciones()) {
                setMensaje(resultado.mensaje ?? "Publicación eliminada.");
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : "No se pudo conectar con el servidor.");
            setPublicacionPendiente(null);
        } finally {
            setEliminando(false);
        }
    }

    const gruposPorEspecie = new Map<
        number,
        {
            especie: Publicacion["presentacion"]["variedad"]["especie"];
            items: Publicacion[];
        }
    >();

    for (const pub of publicacionesVisibles) {
        const especie = pub.presentacion.variedad.especie;

        if (!gruposPorEspecie.has(especie.id)) {
            gruposPorEspecie.set(especie.id, {
                especie,
                items: [],
            });
        }

        gruposPorEspecie.get(especie.id)!.items.push(pub);
    }

    const grupos = Array.from(gruposPorEspecie.values());
    grupos.sort((primero, segundo) => {
        if (ordenActual === "prioridad" || ordenActual === "precioAsc" || ordenActual === "precioDesc") {
            return compararEspeciesPorPrioridad(primero.especie.nombreEspecie, segundo.especie.nombreEspecie);
        }
        const comparacion = primero.especie.nombreEspecie.localeCompare(segundo.especie.nombreEspecie, "es", { sensitivity: "base" });
        return ordenActual === "alfabeticoDesc" ? -comparacion : comparacion;
    });

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
                <header className="encabezado-pagina relative isolate overflow-hidden rounded-2xl bg-secondary">
                    <HojasDecorativas />
                    <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--color-subtitulo-pagina)]">
                                Mis publicaciones
                            </p>

                            <h1 className="titulo-pagina">
                                Mi Mercado
                            </h1>

                            <p className="subtitulo-pagina mt-1">
                                Consultá los productos que tenés publicados.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:items-end">
                            <p className="subtitulo-pagina">
                                {publicacionesVigentes.length}{" "}{publicacionesVigentes.length === 1 ? "publicación" : "publicaciones"}
                            </p>
                            {puedeCrear && <button type="button" onClick={abrirAlta} className="rounded-lg bg-surface px-4 py-3 text-sm font-semibold text-secondary hover:bg-primary-soft">Nueva publicación</button>}
                        </div>
                    </div>
                </header>

                {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}
                {mensaje && <p className="rounded-lg bg-primary-soft p-4 text-sm text-secondary" role="status">{mensaje}</p>}

                {/* Estado vacío */}
                {publicacionesVigentes.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-surface p-[var(--padding-panel)] text-center shadow-sm">
                        <h2 className="text-xl font-bold text-foreground">
                            No tenés publicaciones
                        </h2>

                        <p className="mt-2 text-sm text-muted">
                            Cuando tengas productos publicados aparecerán acá.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className={styles.filtros}>
                            <FiltrosPublicaciones publicaciones={publicacionesParaFiltros} especieFiltro="" ordenInicial="prioridad" alFiltrar={setPublicacionesFiltradas} alCambiarOrden={setOrdenActual} />
                        </div>
                        {/* Controles */}
                        <div className={styles.encabezadoCatalogo}>
                            <h2 className={styles.titulo}>
                                Publicaciones
                            </h2>

                            <button
                                type="button"
                                aria-pressed={agruparPorEspecie}
                                onClick={() =>
                                    setAgruparPorEspecie(
                                        (valorActual) => !valorActual
                                    )
                                }
                                className={`${styles.botonAgrupar} ${agruparPorEspecie ? styles.botonAgruparActivo : ""}`}
                            >
                                {agruparPorEspecie
                                    ? "Desagrupar"
                                    : "Agrupar por especie"}
                            </button>
                        </div>

                        {publicacionesVisibles.length === 0 ? (
                            <p className={styles.sinResultados}>No hay publicaciones que coincidan con la búsqueda.</p>
                        ) : agruparPorEspecie ? (
                            <div className="secciones-pagina">
                                {grupos.map(({ especie, items }) => (
                                    <section key={especie.id} className="secciones-pagina">

                                        {/* Encabezado de especie */}
                                        <div className="flex items-center gap-2 border-b border-border pb-2">
                                            <h3 className="text-xl font-bold text-foreground">
                                                {especie.nombreEspecie}
                                            </h3>

                                            <span className="text-sm text-muted">
                                                · {items.length}{" "}
                                                {items.length === 1
                                                    ? "publicación"
                                                    : "publicaciones"}
                                            </span>
                                        </div>

                                        {/* Tarjetas */}
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 tarjetas-compactas-mercado">
                                            {items.map((pub) => (
                                                <TarjetaPublicacion
                                                    key={pub.id}
                                                    pub={pub}
                                                    operadorId={operadorId}
                                                    puedeModificar={puedeModificar}
                                                    incrementoPrecio={
                                                        incrementoPrecio
                                                    }
                                                    alConsultar={consultarPublicacion}
                                                    alPrecioActualizado={actualizarPrecioLocal}
                                                    alPublicacionEliminada={() => void sincronizarPublicaciones()}
                                                />
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 tarjetas-compactas-mercado">
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
                    </>
                )}
            </div>
            {puedeCrear && altaAbierta && <NuevaPublicacion operadorId={operadorId} incrementoPrecio={incrementoPrecio} abierto={altaAbierta} alCerrar={cerrarAlta} alCrear={publicacionCreada} />}
            <DrawerEditarPublicacion incrementoPrecio={incrementoPrecio} abierto={publicacionSeleccionada !== null} alCerrar={() => setSeleccion(null)} alGuardar={guardarCambios} publicacion={publicacionParaEditar} modoInicial="consulta" puedeModificar={puedeModificar} puedeEliminar={puedeEliminar} alEliminar={() => { if (publicacionSeleccionada) solicitarBaja(publicacionSeleccionada); }} eliminando={eliminando} actualizando={sincronizando} errorConsulta={error} {...opcionesEdicion}>
                <ConfirmModal abierto={publicacionPendiente !== null} titulo="Eliminar publicación" descripcion={publicacionPendiente ? `¿Querés eliminar la publicación de ${publicacionPendiente.presentacion.variedad.especie.nombreEspecie}? Esta acción no se puede deshacer.` : ""} textoConfirmar="Sí, eliminar" procesando={eliminando} alCancelar={() => { if (!eliminando) setPublicacionPendiente(null); }} alConfirmar={() => void eliminarPublicacion()} />
            </DrawerEditarPublicacion>
        </main>
    );
}
