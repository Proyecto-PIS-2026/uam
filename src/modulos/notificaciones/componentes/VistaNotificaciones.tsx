"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CheckIcon from "@mui/icons-material/Check";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import DeleteSweepOutlinedIcon from "@mui/icons-material/DeleteSweepOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import { ConfirmModal } from "@/compartido/componentes/ConfirmModal";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import { notificarCambioNotificaciones } from "../cliente";
import { urlInternaNotificacion } from "../validacion-url";
import type { NotificacionesUsuario } from "../tipos";
import styles from "./VistaNotificaciones.module.css";

type Props = { usuarioId: number };
type Operacion = "leer" | "borrar";

class ErrorNotificaciones extends Error {}

const formatoFecha = new Intl.DateTimeFormat("es-UY", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Montevideo",
});

function mensajeError(datos: unknown, alternativa: string): string {
    if (!datos || typeof datos !== "object") return alternativa;
    const respuesta = datos as { errores?: unknown; error?: unknown };
    if (Array.isArray(respuesta.errores)) {
        const mensajes = respuesta.errores.filter((mensaje): mensaje is string => typeof mensaje === "string" && mensaje.trim() !== "");
        if (mensajes.length > 0) return mensajes.join(" ");
    }
    return typeof respuesta.error === "string" && respuesta.error.trim() ? respuesta.error : alternativa;
}

function leerContador(datos: unknown): number {
    const contador = datos && typeof datos === "object" && "noLeidas" in datos ? datos.noLeidas : undefined;
    if (typeof contador !== "number" || !Number.isSafeInteger(contador) || contador < 0) throw new ErrorNotificaciones("La respuesta del servidor no es válida. Intentá nuevamente.");
    return contador;
}

export default function VistaNotificaciones({ usuarioId }: Props) {
    const { notificar, cerrarNotificacion } = useNotificacionToast();
    const [datos, setDatos] = useState<{ usuarioId: number; listado: NotificacionesUsuario } | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [guardando, setGuardando] = useState<string | null>(null);
    const [confirmarBorrado, setConfirmarBorrado] = useState(false);
    const montado = useRef(false);
    const carga = useRef<AbortController | null>(null);
    const mutacion = useRef<AbortController | null>(null);
    const listado = datos?.usuarioId === usuarioId ? datos.listado : null;

    const cargar = useCallback(async () => {
        if (!montado.current || carga.current || mutacion.current) return;
        const solicitud = new AbortController();
        carga.current = solicitud;
        try {
            const respuesta = await fetch("/api/notificaciones", { cache: "no-store", signal: solicitud.signal });
            const resultado: unknown = await respuesta.json();
            if (!montado.current || carga.current !== solicitud || solicitud.signal.aborted) return;
            if (!respuesta.ok) throw new ErrorNotificaciones(mensajeError(resultado, "No se pudieron cargar las notificaciones. Intentá nuevamente."));
            const noLeidas = leerContador(resultado);
            if (!resultado || typeof resultado !== "object" || !("notificaciones" in resultado) || !Array.isArray(resultado.notificaciones)) {
                throw new ErrorNotificaciones("La respuesta del servidor no es válida. Intentá nuevamente.");
            }
            setDatos({ usuarioId, listado: { notificaciones: (resultado as NotificacionesUsuario).notificaciones, noLeidas } });
            setError("");
            notificarCambioNotificaciones(usuarioId, noLeidas);
        } catch (razon) {
            if (!montado.current || carga.current !== solicitud || solicitud.signal.aborted) return;
            const mensaje = razon instanceof ErrorNotificaciones ? razon.message : "No se pudieron cargar las notificaciones. Intentá nuevamente.";
            setError(mensaje);
            notificar(mensaje, "error");
        } finally {
            if (carga.current === solicitud) {
                carga.current = null;
                if (montado.current) setCargando(false);
            }
        }
    }, [usuarioId, notificar]);

    useEffect(() => {
        montado.current = true;
        queueMicrotask(() => { void cargar(); });
        const actualizarVisible = () => {
            if (document.visibilityState === "visible" && !carga.current && !mutacion.current) {
                setCargando(true);
                void cargar();
            }
        };
        const intervalo = window.setInterval(actualizarVisible, 60_000);
        window.addEventListener("focus", actualizarVisible);
        document.addEventListener("visibilitychange", actualizarVisible);
        return () => {
            montado.current = false;
            carga.current?.abort();
            mutacion.current?.abort();
            carga.current = null;
            mutacion.current = null;
            window.clearInterval(intervalo);
            window.removeEventListener("focus", actualizarVisible);
            document.removeEventListener("visibilitychange", actualizarVisible);
        };
    }, [cargar]);

    async function modificar(operacion: Operacion, id?: number) {
        if (!listado || mutacion.current) return;
        const solicitud = new AbortController();
        mutacion.current = solicitud;
        carga.current?.abort();
        carga.current = null;
        setCargando(false);
        setGuardando(`${operacion}:${id ?? "todas"}`);
        cerrarNotificacion();
        const alternativa = operacion === "leer" ? "No se pudieron marcar las notificaciones como leídas. Intentá nuevamente." : "No se pudieron borrar las notificaciones. Intentá nuevamente.";
        try {
            const respuesta = await fetch(`/api/notificaciones${id === undefined ? "" : `/${id}`}`, {
                method: operacion === "leer" ? "PATCH" : "DELETE", signal: solicitud.signal,
            });
            const resultado: unknown = await respuesta.json();
            if (!montado.current || mutacion.current !== solicitud || solicitud.signal.aborted) return;
            if (!respuesta.ok) throw new ErrorNotificaciones(mensajeError(resultado, alternativa));
            const noLeidas = leerContador(resultado);
            setDatos((actual) => {
                if (actual?.usuarioId !== usuarioId) return actual;
                const notificaciones = operacion === "leer"
                    ? actual.listado.notificaciones.map((aviso) => id === undefined || aviso.id === id ? { ...aviso, leida: true } : aviso)
                    : actual.listado.notificaciones.filter((aviso) => id !== undefined && aviso.id !== id);
                return { usuarioId, listado: { notificaciones, noLeidas } };
            });
            notificarCambioNotificaciones(usuarioId, noLeidas);
            notificar(operacion === "leer"
                ? id === undefined ? "Todas las notificaciones se marcaron como leídas." : "Notificación marcada como leída."
                : id === undefined ? "Se borraron todas las notificaciones." : "Notificación borrada.", "success");
        } catch (razon) {
            if (montado.current && mutacion.current === solicitud && !solicitud.signal.aborted) {
                notificar(razon instanceof ErrorNotificaciones ? razon.message : alternativa, "error");
            }
        } finally {
            if (mutacion.current === solicitud) {
                mutacion.current = null;
                if (montado.current) {
                    setGuardando(null);
                    setConfirmarBorrado(false);
                }
            }
        }
    }

    const ocupado = guardando !== null;

    return (
        <main className="contenedor-pagina secciones-pagina flex-1">
            <EncabezadoPagina titulo="Notificaciones" subtitulo={listado
                ? `${listado.noLeidas} ${listado.noLeidas === 1 ? "notificación sin leer" : "notificaciones sin leer"}`
                : "Consultá tus avisos y novedades."} />
            <section className={styles.contenido} aria-label="Tus notificaciones" aria-busy={cargando || ocupado}>
                <div className={styles.barraAcciones}>
                    <div className={styles.accionesGenerales}>
                        <button type="button" className={`boton-secundario ${styles.leer}`} onClick={() => void modificar("leer")} disabled={!listado || listado.noLeidas === 0 || ocupado} aria-busy={guardando === "leer:todas"}>
                            <DoneAllIcon fontSize="small" aria-hidden="true" />Leer todo
                        </button>
                        <button type="button" className={`boton-secundario ${styles.borrarTodo}`} onClick={() => { cerrarNotificacion(); setConfirmarBorrado(true); }} disabled={!listado?.notificaciones.length || ocupado}>
                            <DeleteSweepOutlinedIcon fontSize="small" aria-hidden="true" />Borrar todo
                        </button>
                    </div>
                </div>
                {error && <div className={styles.error}>
                    <CloudOffOutlinedIcon aria-hidden="true" />
                    <p>{error}</p>
                    <button type="button" className="boton-secundario" onClick={() => { cerrarNotificacion(); setCargando(true); void cargar(); }} disabled={cargando || ocupado}>
                        <RefreshIcon fontSize="small" aria-hidden="true" />Reintentar
                    </button>
                </div>}
                {!listado && cargando && <div className={styles.carga} role="status">
                    <NotificationsNoneOutlinedIcon aria-hidden="true" />
                    <p>Cargando notificaciones...</p>
                </div>}
                {listado?.notificaciones.length === 0 && <EstadoVacio
                    titulo="No tenés notificaciones"
                    descripcion="Tus avisos y novedades aparecerán aquí."
                    icono={<NotificationsNoneOutlinedIcon />}
                    nivelTitulo={2}
                    anunciar={false}
                />}
                {listado && listado.notificaciones.length > 0 && <ul className={styles.lista} aria-label="Notificaciones recibidas">
                    {listado.notificaciones.map((aviso) => {
                        const href = urlInternaNotificacion(aviso.url);
                        const textoId = `notificacion-${aviso.id}-texto`;
                        const fecha = new Date(aviso.fecha);
                        return <li key={aviso.id} className={styles.fila} data-leida={aviso.leida}>
                            <div className={styles.aviso}>
                                {href ? <Link href={href} id={textoId} className={styles.texto}>{aviso.texto}</Link> : <p id={textoId} className={styles.texto}>{aviso.texto}</p>}
                                <div className={styles.detalle}>
                                    <span className={styles.estado}>{aviso.leida ? "Leída" : "No leída"}</span>
                                    <time dateTime={aviso.fecha}>{Number.isNaN(fecha.getTime()) ? "Fecha no disponible" : formatoFecha.format(fecha)}</time>
                                </div>
                            </div>
                            <div className={styles.accionesFila}>
                                <button type="button" className={`${styles.accion} ${styles.leer}`} aria-label={aviso.leida ? "Notificación leída" : "Marcar como leída"} aria-describedby={textoId}
                                    title={aviso.leida ? "Notificación leída" : "Marcar como leída"} disabled={aviso.leida || ocupado} aria-busy={guardando === `leer:${aviso.id}`} onClick={() => void modificar("leer", aviso.id)}>
                                    <CheckIcon aria-hidden="true" />
                                </button>
                                <button type="button" className={`${styles.accion} ${styles.borrar}`} aria-label="Borrar notificación" aria-describedby={textoId} title="Borrar notificación"
                                    disabled={ocupado} aria-busy={guardando === `borrar:${aviso.id}`} onClick={() => void modificar("borrar", aviso.id)}>
                                    <DeleteOutlineIcon aria-hidden="true" />
                                </button>
                            </div>
                        </li>;
                    })}
                </ul>}
            </section>
            <ConfirmModal abierto={confirmarBorrado} titulo="Borrar todas las notificaciones" descripcion="Se borrarán todas tus notificaciones. Esta acción no se puede deshacer." textoConfirmar="Sí, borrar todas"
                procesando={guardando === "borrar:todas"} alCancelar={() => { if (!mutacion.current) setConfirmarBorrado(false); }} alConfirmar={() => void modificar("borrar")} />
        </main>
    );
}
