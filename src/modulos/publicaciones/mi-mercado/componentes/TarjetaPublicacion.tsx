"use client";

import { useRef, useState } from "react";
import NotificacionToast, { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import type { Publicacion } from "../tipos";
import { actualizarPrecio, incrementarPrecio } from "../acciones";
import styles from "./TarjetaPublicacion.module.css";

type Props = {
    pub: Publicacion;
    operadorId: number;
    puedeModificar: boolean;
    incrementoPrecio: number;
    alConsultar?: (publicacion: Publicacion) => void;
    alPrecioActualizado?: (publicacionId: number, nuevoPrecio: number, fecha?: string, version?: number) => void;
    alPublicacionEliminada?: () => void;
};

export default function TarjetaPublicacion({
    pub,
    operadorId,
    puedeModificar,
    incrementoPrecio,
    alConsultar,
    alPrecioActualizado,
    alPublicacionEliminada,
}: Props) {
    const { notificacion, notificar, cerrarNotificacion } = useNotificacionToast();
    const recibido = { precio: Number(pub.precio ?? 0), version: pub.version, fecha: pub.fecha };
    const [confirmado, setConfirmado] = useState(recibido);
    const actual = confirmado.version > recibido.version ? confirmado : recibido;
    const [optimista, setOptimista] = useState<number | null>(null);
    const precio = optimista ?? actual.precio;
    const [errorPrecio, setErrorPrecio] = useState("");
    const guardandoRef = useRef(false);
    const incrementosPendientesRef = useRef(0);
    const precioVisibleRef = useRef(recibido.precio);
    const versionEdicionRef = useRef(pub.version);
    const [guardandoPrecio, setGuardandoPrecio] = useState(false);
    const [guardandoManual, setGuardandoManual] = useState(false);
    const [editandoPrecio, setEditandoPrecio] = useState(false);
    const [precioTemporal, setPrecioTemporal] = useState(String(precio));

    async function guardar(valor: number) {
        if (guardandoRef.current) return;
        const nuevoPrecio = valor;
        if (!Number.isSafeInteger(nuevoPrecio) || nuevoPrecio <= 0 || nuevoPrecio > 9_999_999_999) {
            setErrorPrecio("El precio debe ser un entero positivo de hasta 10 dígitos.");
            return;
        }
        cerrarNotificacion();
        guardandoRef.current = true;
        setGuardandoPrecio(true);
        setGuardandoManual(true);
        setOptimista(nuevoPrecio);
        setErrorPrecio("");
        try {
            const resultado = await actualizarPrecio(pub.id, valor, operadorId, versionEdicionRef.current);
            if (resultado.publicacionEliminada) {
                alPublicacionEliminada?.();
                return;
            }
            const precioActual = Number(resultado.precio ?? 0);
            setConfirmado({ precio: precioActual, version: resultado.version, fecha: resultado.fecha });
            alPrecioActualizado?.(pub.id, precioActual, resultado.fecha, resultado.version);
            if (resultado.conflicto) notificar("El precio cambió en otra sesión. Se muestra el valor actual. Revisalo antes de volver a guardar.", "warning");
        } catch (error) {
            notificar(error instanceof Error ? error.message : "No se pudo guardar el precio.", "error");
        } finally {
            guardandoRef.current = false;
            setGuardandoPrecio(false);
            setGuardandoManual(false);
            setOptimista(null);
        }
    }

    async function guardarIncrementos() {
        if (guardandoRef.current) return;
        cerrarNotificacion();
        guardandoRef.current = true;
        setGuardandoPrecio(true);
        setErrorPrecio("");
        try {
            while (incrementosPendientesRef.current !== 0) {
                const incremento = incrementosPendientesRef.current;
                incrementosPendientesRef.current = 0;
                const resultado = await incrementarPrecio(pub.id, incremento, operadorId);
                if (resultado.publicacionEliminada) {
                    incrementosPendientesRef.current = 0;
                    alPublicacionEliminada?.();
                    return;
                }
                const precioActual = Number(resultado.precio ?? 0);
                setConfirmado({ precio: precioActual, version: resultado.version, fecha: resultado.fecha });
                alPrecioActualizado?.(pub.id, precioActual, resultado.fecha, resultado.version);
                if (resultado.conflicto) {
                    incrementosPendientesRef.current = 0;
                    notificar("La publicación cambió en otra sesión. Revisá el precio actualizado y volvé a intentar.", "warning");
                }
                precioVisibleRef.current = precioActual + incrementosPendientesRef.current;
                setOptimista(precioVisibleRef.current);
            }
        } catch (error) {
            incrementosPendientesRef.current = 0;
            notificar(error instanceof Error ? error.message : "No se pudo guardar el precio.", "error");
        } finally {
            guardandoRef.current = false;
            setGuardandoPrecio(false);
            setOptimista(null);
        }
    }

    function cambiarPorIncremento(incremento: number) {
        if (guardandoManual) return;
        const precioActual = guardandoRef.current ? precioVisibleRef.current : actual.precio;
        const siguiente = precioActual + incremento;
        if (!Number.isSafeInteger(siguiente) || siguiente <= 0 || siguiente > 9_999_999_999) return;
        incrementosPendientesRef.current += incremento;
        precioVisibleRef.current = siguiente;
        setOptimista(siguiente);
        void guardarIncrementos();
    }

    function consultarPublicacion() {
        alConsultar?.({ ...pub, precio: pub.precio === null && precio === 0 ? null : String(precio), version: actual.version, fecha: actual.fecha });
    }

    function restar() {
        cambiarPorIncremento(-incrementoPrecio);
    }

    function sumar() {
        cambiarPorIncremento(incrementoPrecio);
    }

    function comenzarEdicionPrecio() {
        versionEdicionRef.current = actual.version;
        setPrecioTemporal(String(precio));
        setEditandoPrecio(true);
    }

    function guardarPrecioManual() {
        if (!editandoPrecio) return;
        setEditandoPrecio(false);
        const texto = precioTemporal.trim();
        if (texto === "" || Number(texto) === precio) return;
        void guardar(Number(texto));
    }

    function cancelarEdicionPrecio() {
        setPrecioTemporal(String(precio));
        setEditandoPrecio(false);
    }

    const variedad = pub.presentacion.variedad.nombreVariedad;
    const especie = pub.presentacion.variedad.especie.nombreEspecie;
    const presentacion = pub.presentacion.nombrePresentacion;
    const categoria = pub.categoria.nombreCategoria;
    const calibre = pub.calibre.nombreCalibre;
    const tieneVariedad = variedad && variedad.trim() !== "" && variedad.trim() !== "-";
    const nombreProducto = tieneVariedad ? `${especie} · ${variedad}` : especie;

    const contenido = (
        <div className={styles.tarjeta}>
            <button type="button" onClick={consultarPublicacion} className={styles.botonFoto} aria-label={`Ver detalle de ${nombreProducto}`}>
                <ImagenPublicacion src={pub.foto} alt={nombreProducto} fill sizes="(max-width: 639px) 112px, (max-width: 700px) 128px, (max-width: 776px) calc(50vw - 22px), (max-width: 1028px) calc(33.333vw - 18.667px), (max-width: 1279px) calc(25vw - 17px), 320px" unoptimized className={styles.foto} reemplazo={<div className={styles.sinFoto}>Sin fotografía</div>} />
            </button>
            <div className={styles.contenido}>
                <button type="button" onClick={consultarPublicacion} className={styles.botonInformacion}>
                    <div className={styles.informacion}>
                        <div className={styles.encabezadoProducto}>
                            <div className={styles.nombreProducto} title={nombreProducto}>
                                {nombreProducto}
                            </div>
                            <span className={`${styles.estado} ${pub.publicacionDisponible ? styles.disponible : styles.noDisponible}`}>
                                {pub.publicacionDisponible ? "Disponible" : "No disponible"}
                            </span>
                        </div>
                        <div className={styles.datos}>
                            {calibre || "-"}
                            {" · "}
                            Cat. {categoria || "-"}
                            {" · "}
                            {presentacion || "-"}
                        </div>
                    </div>
                </button>
                <div className={styles.contenedorPrecio}>
                    <div className={styles.controlesPrecio}>
                        <button type="button" className={styles.botonPrecio} onClick={restar} disabled={guardandoManual || editandoPrecio || !puedeModificar} aria-label="Disminuir precio">
                            −
                        </button>
                        {editandoPrecio && puedeModificar ? (
                            <input
                                autoFocus
                                type="text"
                                inputMode="numeric"
                                maxLength={10}
                                value={precioTemporal}
                                className={styles.inputPrecio}
                                aria-label="Editar precio"
                                onChange={(e) => {
                                    if (/^\d{0,10}$/.test(e.target.value)) setPrecioTemporal(e.target.value);
                                }}
                                onBlur={guardarPrecioManual}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        guardarPrecioManual();
                                    }
                                    if (e.key === "Escape") {
                                        e.preventDefault();
                                        cancelarEdicionPrecio();
                                    }
                                }}
                            />
                        ) : (
                            <button type="button" onClick={comenzarEdicionPrecio} className={styles.precio} title="Editar precio" disabled={guardandoPrecio || !puedeModificar}>
                                {precio === 0 ? "Sin precio" : `$${precio}`}
                            </button>
                        )}
                        <button type="button" className={styles.botonPrecio} onClick={sumar} disabled={guardandoManual || editandoPrecio || !puedeModificar} aria-label="Aumentar precio">
                            +
                        </button>
                    </div>
                    <button type="button" onClick={consultarPublicacion} className={styles.botonDetalle} aria-label={`Ver detalle de ${nombreProducto}`}>
                        ›
                    </button>
                </div>
                {errorPrecio && <div role="alert" className={styles.errorPrecio}>{errorPrecio}</div>}
            </div>
        </div>
    );
    return <>{contenido}<NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} /></>;
}
