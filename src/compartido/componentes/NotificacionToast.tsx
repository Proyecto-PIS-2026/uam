"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import CloseIcon from "@mui/icons-material/Close";
import Alert from "@mui/material/Alert";
import Fade from "@mui/material/Fade";
import Portal from "@mui/material/Portal";
import styles from "./NotificacionToast.module.css";

type TipoNotificacion = "success" | "error" | "warning" | "info";

type Notificacion = { id: number; origen: string; mensaje: string; tipo: TipoNotificacion; cerrando?: boolean };
type ServicioNotificaciones = {
    agregar: (origen: string, mensaje: string, tipo: TipoNotificacion) => void;
    cerrarOrigen: (origen: string) => void;
};

const ContextoNotificaciones = createContext<ServicioNotificaciones | null>(null);
const DURACION = 5000;
const DURACION_SALIDA = 160;

export function useNotificacionToast() {
    const servicio = useContext(ContextoNotificaciones);
    const origen = useId();
    if (!servicio) throw new Error("Falta ProveedorNotificacionesToast.");
    const notificar = useCallback((mensaje: string, tipo: TipoNotificacion) => {
        servicio.agregar(origen, mensaje, tipo);
    }, [servicio, origen]);
    const cerrarNotificacion = useCallback(() => servicio.cerrarOrigen(origen), [servicio, origen]);
    return { notificar, cerrarNotificacion };
}

function useContenedorNotificaciones(activo: boolean) {
    const [contenedor, setContenedor] = useState<HTMLElement | null>(null);
    useEffect(() => {
        if (!activo) return;
        const actualizar = () => {
            const modales = Array.from(document.querySelectorAll<HTMLElement>(".MuiModal-root"))
                .filter((modal) => modal.getAttribute("aria-hidden") !== "true" && getComputedStyle(modal).display !== "none");
            const modal = modales.at(-1);
            const destino = modal?.querySelector<HTMLElement>(".MuiDialog-paper, .MuiDrawer-paper, .MuiPopover-paper") ?? document.body;
            setContenedor((actual) => actual === destino ? actual : destino);
        };
        actualizar();
        const observador = new MutationObserver(actualizar);
        observador.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-hidden"] });
        return () => observador.disconnect();
    }, [activo]);
    return contenedor;
}

function useEspacioVisible() {
    const [espacio, setEspacio] = useState<CSSProperties>({});
    useEffect(() => {
        const viewport = window.visualViewport;
        const actualizar = () => {
            setEspacio({
                "--toast-ancho-visible": `${viewport?.width ?? window.innerWidth}px`,
                "--toast-alto-visible": `${viewport?.height ?? window.innerHeight}px`,
                "--toast-inferior": `${viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0}px`,
                "--toast-derecha": `${viewport ? Math.max(0, window.innerWidth - viewport.width - viewport.offsetLeft) : 0}px`,
            } as CSSProperties);
        };
        actualizar();
        window.addEventListener("resize", actualizar);
        viewport?.addEventListener("resize", actualizar);
        viewport?.addEventListener("scroll", actualizar);
        return () => {
            window.removeEventListener("resize", actualizar);
            viewport?.removeEventListener("resize", actualizar);
            viewport?.removeEventListener("scroll", actualizar);
        };
    }, []);
    return espacio;
}

export function ProveedorNotificacionesToast({ children }: { children: ReactNode }) {
    const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
    const pausas = useRef(new Set<string>());
    const [revisionPausas, setRevisionPausas] = useState(0);
    const [ventanaPausada, setVentanaPausada] = useState(false);
    const siguienteId = useRef(0);
    const temporizadores = useRef(new Map<number, { referencia: ReturnType<typeof setTimeout>; salida: boolean }>());
    const viewportRef = useRef<HTMLDivElement>(null);
    const asignarViewport = useCallback((viewport: HTMLDivElement | null) => {
        viewportRef.current = viewport;
        if (!viewport) return;
        if (typeof viewport.showPopover === "function") {
            viewport.setAttribute("popover", "manual");
            viewport.showPopover();
        }
        viewport.scrollTop = viewport.scrollHeight;
        if (pausas.current.size > 0) {
            pausas.current.clear();
            setRevisionPausas((revision) => revision + 1);
        }
    }, []);
    const contenedor = useContenedorNotificaciones(notificaciones.length > 0);
    const espacio = useEspacioVisible();

    const cerrar = useCallback((id: number) => {
        setNotificaciones((actuales) => actuales.map((aviso) => aviso.id === id ? { ...aviso, cerrando: true } : aviso));
    }, []);
    const retirar = useCallback((id: number) => {
        setNotificaciones((actuales) => actuales.filter((aviso) => aviso.id !== id));
    }, []);
    const agregar = useCallback((origen: string, mensaje: string, tipo: TipoNotificacion) => {
        if (!mensaje.trim()) return;
        const id = ++siguienteId.current;
        setNotificaciones((actuales) => {
            const siguientes = [...actuales, { id, origen, mensaje, tipo }];
            const visibles = new Set(siguientes.filter((aviso) => !aviso.cerrando).slice(-3).map((aviso) => aviso.id));
            return siguientes.map((aviso) => visibles.has(aviso.id) ? aviso : { ...aviso, cerrando: true });
        });
    }, []);
    const cerrarOrigen = useCallback((origen: string) => {
        setNotificaciones((actuales) => actuales.map((aviso) => aviso.origen === origen ? { ...aviso, cerrando: true } : aviso));
    }, []);
    const servicio = useMemo(() => ({ agregar, cerrarOrigen }), [agregar, cerrarOrigen]);
    const pausar = useCallback((id: number, motivo: "puntero" | "foco", activa: boolean) => {
        const clave = `${id}:${motivo}`;
        if (pausas.current.has(clave) === activa) return;
        if (activa) pausas.current.add(clave);
        else pausas.current.delete(clave);
        setRevisionPausas((revision) => revision + 1);
    }, []);

    useEffect(() => {
        let sinFoco = false;
        const actualizar = () => setVentanaPausada(sinFoco || document.hidden);
        const perderFoco = () => { sinFoco = true; actualizar(); };
        const recuperarFoco = () => { sinFoco = false; actualizar(); };
        actualizar();
        window.addEventListener("blur", perderFoco);
        window.addEventListener("focus", recuperarFoco);
        document.addEventListener("visibilitychange", actualizar);
        return () => {
            window.removeEventListener("blur", perderFoco);
            window.removeEventListener("focus", recuperarFoco);
            document.removeEventListener("visibilitychange", actualizar);
        };
    }, []);

    useEffect(() => {
        const porId = new Map(notificaciones.map((aviso) => [aviso.id, aviso]));
        const estaPausada = (id: number) => ventanaPausada || pausas.current.has(`${id}:puntero`) || pausas.current.has(`${id}:foco`);
        for (const [id, temporizador] of temporizadores.current) {
            const aviso = porId.get(id);
            if (!aviso || temporizador.salida !== !!aviso.cerrando || (!aviso.cerrando && estaPausada(id))) {
                clearTimeout(temporizador.referencia);
                temporizadores.current.delete(id);
            }
        }
        for (const { id, cerrando } of notificaciones) {
            if ((cerrando || !estaPausada(id)) && !temporizadores.current.has(id)) {
                temporizadores.current.set(id, {
                    referencia: setTimeout(() => cerrando ? retirar(id) : cerrar(id), cerrando ? DURACION_SALIDA : DURACION),
                    salida: !!cerrando,
                });
            }
        }
        for (const clave of pausas.current) {
            const aviso = porId.get(Number(clave.split(":")[0]));
            if (!aviso || aviso.cerrando) pausas.current.delete(clave);
        }
    }, [notificaciones, revisionPausas, ventanaPausada, cerrar, retirar]);

    useEffect(() => {
        const pendientes = temporizadores.current;
        return () => { pendientes.forEach(({ referencia }) => clearTimeout(referencia)); pendientes.clear(); };
    }, []);

    useEffect(() => {
        const reciente = notificaciones.filter((aviso) => !aviso.cerrando).at(-1);
        if (!reciente) return;
        const cerrarConEscape = (evento: KeyboardEvent) => {
            if (evento.key !== "Escape" || evento.defaultPrevented) return;
            evento.preventDefault();
            evento.stopPropagation();
            cerrar(reciente.id);
        };
        document.addEventListener("keydown", cerrarConEscape, true);
        return () => document.removeEventListener("keydown", cerrarConEscape, true);
    }, [notificaciones, cerrar]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }, [notificaciones, contenedor, espacio]);

    return (
        <ContextoNotificaciones.Provider value={servicio}>
            {children}
            {contenedor && notificaciones.length > 0 && (
                <Portal container={contenedor}>
                    <div ref={asignarViewport} className={styles.contenedor} style={espacio} role="region" aria-label="Notificaciones">
                        <div className={styles.pila}>
                            {notificaciones.map((aviso, indice) => {
                                const urgente = aviso.tipo === "error" || aviso.tipo === "warning";
                                return (
                                    <div key={aviso.id} className={`${styles.elemento} ${indice < notificaciones.length - 2 ? styles.antigua : ""}`} aria-hidden={aviso.cerrando || undefined} inert={aviso.cerrando || undefined}>
                                        <Fade in={!aviso.cerrando} appear timeout={{ enter: 200, exit: DURACION_SALIDA }} onExited={() => retirar(aviso.id)}>
                                            <Alert
                                                className={`${styles.alerta} ${styles[aviso.tipo]}`}
                                                severity={aviso.tipo}
                                                variant="filled"
                                                role={urgente ? "alert" : "status"}
                                                aria-live={urgente ? "assertive" : "polite"}
                                                aria-atomic="true"
                                                closeText="Cerrar notificación"
                                                slots={{ closeIcon: CloseIcon }}
                                                onClose={() => cerrar(aviso.id)}
                                                onMouseEnter={() => pausar(aviso.id, "puntero", true)}
                                                onMouseLeave={() => pausar(aviso.id, "puntero", false)}
                                                onFocus={() => pausar(aviso.id, "foco", true)}
                                                onBlur={(evento) => { if (!evento.currentTarget.contains(evento.relatedTarget)) pausar(aviso.id, "foco", false); }}
                                            >
                                                {aviso.mensaje}
                                            </Alert>
                                        </Fade>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Portal>
            )}
        </ContextoNotificaciones.Provider>
    );
}
