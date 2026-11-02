"use client";

import { useRef, useState } from "react";
import OutlinedInput from "@mui/material/OutlinedInput";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import type { Publicacion } from "../tipos";
import { actualizarPrecio, incrementarPrecio } from "../acciones";
import { AYUDA_PRECIO_PUBLICACION, MAXIMO_DIGITOS_PRECIO, MAXIMO_PRECIO_PUBLICACION, PRECIO_PUBLICACION_INVALIDO, esEntradaPrecioPublicacion, normalizarPrecioPublicacion, precioPublicacionValido } from "../../precio-publicacion";
import styles from "./TarjetaPublicacion.module.css";

type Props = {
    pub: Publicacion;
    operadorId: number;
    puedeModificar: boolean;
    incrementoPrecio: number;
    alConsultar?: (publicacion: Publicacion) => void;
    alPrecioActualizado?: (publicacionId: number, nuevoPrecio: number | null, fecha?: string, version?: number) => void;
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
    const { notificar } = useNotificacionToast();
    const recibido = { precio: pub.precio === null ? null : Number(pub.precio), version: pub.version, fecha: pub.fecha };
    const [confirmado, setConfirmado] = useState(recibido);
    const actual = confirmado.version > recibido.version ? confirmado : recibido;
    const [optimista, setOptimista] = useState<number | null | undefined>(undefined);
    const precio = optimista === undefined ? actual.precio : optimista;
    const [errorPrecio, setErrorPrecio] = useState("");
    const guardandoRef = useRef(false);
    const incrementosPendientesRef = useRef<number[]>([]);
    const precioVisibleRef = useRef(recibido.precio ?? 0);
    const versionEdicionRef = useRef(pub.version);
    const [guardandoPrecio, setGuardandoPrecio] = useState(false);
    const [guardandoManual, setGuardandoManual] = useState(false);
    const [editandoPrecio, setEditandoPrecio] = useState(false);
    const [precioTemporal, setPrecioTemporal] = useState(precio === null ? "" : String(precio));

    async function guardar(valor: number | null) {
        if (guardandoRef.current) return;
        const nuevoPrecio = valor;
        if (!precioPublicacionValido(nuevoPrecio === null ? null : String(nuevoPrecio))) {
            setErrorPrecio(PRECIO_PUBLICACION_INVALIDO);
            return;
        }
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
            const precioActual = resultado.precio;
            setConfirmado({ precio: precioActual, version: resultado.version, fecha: resultado.fecha });
            alPrecioActualizado?.(pub.id, precioActual, resultado.fecha, resultado.version);
            if (resultado.conflicto) notificar("El precio cambió en otra sesión. Se muestra el valor actual. Revisalo antes de volver a guardar.", "warning");
        } catch (error) {
            notificar(error instanceof Error ? error.message : "No se pudo guardar el precio.", "error");
        } finally {
            guardandoRef.current = false;
            setGuardandoPrecio(false);
            setGuardandoManual(false);
            setOptimista(undefined);
        }
    }

    async function guardarIncrementos() {
        if (guardandoRef.current) return;
        guardandoRef.current = true;
        setGuardandoPrecio(true);
        setErrorPrecio("");
        try {
            while (incrementosPendientesRef.current.length > 0) {
                const incremento = incrementosPendientesRef.current.shift()!;
                const resultado = await incrementarPrecio(pub.id, incremento, operadorId);
                if (resultado.publicacionEliminada) {
                    incrementosPendientesRef.current = [];
                    alPublicacionEliminada?.();
                    return;
                }
                const precioActual = resultado.precio;
                setConfirmado({ precio: precioActual, version: resultado.version, fecha: resultado.fecha });
                alPrecioActualizado?.(pub.id, precioActual, resultado.fecha, resultado.version);
                if (resultado.conflicto) {
                    incrementosPendientesRef.current = [];
                    notificar("La publicación cambió en otra sesión. Revisá el precio actualizado y volvé a intentar.", "warning");
                }
                precioVisibleRef.current = incrementosPendientesRef.current.reduce(
                    (acumulado, pendiente) => Math.max(0, acumulado + pendiente),
                    precioActual ?? 0,
                );
                setOptimista(precioVisibleRef.current <= 0 ? null : precioVisibleRef.current);
            }
        } catch (error) {
            incrementosPendientesRef.current = [];
            notificar(error instanceof Error ? error.message : "No se pudo guardar el precio.", "error");
        } finally {
            guardandoRef.current = false;
            setGuardandoPrecio(false);
            setOptimista(undefined);
        }
    }

    function cambiarPorIncremento(incremento: number) {
        if (guardandoManual) return;
        const precioActual = guardandoRef.current ? precioVisibleRef.current : actual.precio ?? 0;
        if (precioActual <= 0 && incremento < 0) return;
        const siguiente = precioActual + incremento;
        if (!Number.isSafeInteger(siguiente) || siguiente > MAXIMO_PRECIO_PUBLICACION) return;
        const pendientes = incrementosPendientesRef.current;
        const ultimoIndice = pendientes.length - 1;
        if (ultimoIndice >= 0 && Math.sign(pendientes[ultimoIndice]) === Math.sign(incremento)
            && Math.abs(pendientes[ultimoIndice] + incremento) <= MAXIMO_PRECIO_PUBLICACION) {
            pendientes[ultimoIndice] += incremento;
        } else {
            pendientes.push(incremento);
        }
        precioVisibleRef.current = Math.max(0, siguiente);
        setOptimista(siguiente <= 0 ? null : siguiente);
        void guardarIncrementos();
    }

    function consultarPublicacion() {
        alConsultar?.({ ...pub, precio: precio === null ? null : String(precio), version: actual.version, fecha: actual.fecha });
    }

    function restar() {
        cambiarPorIncremento(-incrementoPrecio);
    }

    function sumar() {
        cambiarPorIncremento(incrementoPrecio);
    }

    function comenzarEdicionPrecio() {
        versionEdicionRef.current = actual.version;
        setPrecioTemporal(precio === null ? "" : String(precio));
        setEditandoPrecio(true);
    }

    function guardarPrecioManual() {
        if (!editandoPrecio) return;
        setEditandoPrecio(false);
        if (!precioPublicacionValido(precioTemporal)) {
            setErrorPrecio(PRECIO_PUBLICACION_INVALIDO);
            return;
        }
        const normalizado = normalizarPrecioPublicacion(precioTemporal);
        const nuevoPrecio = normalizado === null ? null : Number(normalizado);
        if (nuevoPrecio === precio) return;
        void guardar(nuevoPrecio);
    }

    function cancelarEdicionPrecio() {
        setPrecioTemporal(precio === null ? "" : String(precio));
        setEditandoPrecio(false);
    }

    const variedad = pub.variedad?.nombreVariedad;
    const especie = pub.especie.nombreEspecie;
    const presentacion = pub.presentacion?.nombrePresentacion;
    const categoria = pub.categoria?.nombreCategoria;
    const calibre = pub.calibre?.nombreCalibre;
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
                            <RemoveIcon aria-hidden="true" fontSize="inherit" />
                        </button>
                        {editandoPrecio && puedeModificar ? (
                            <OutlinedInput
                                color="secondary"
                                autoFocus
                                size="small"
                                type="text"
                                slotProps={{ input: { inputMode: "numeric", maxLength: MAXIMO_DIGITOS_PRECIO, "aria-label": "Editar precio", title: AYUDA_PRECIO_PUBLICACION } }}
                                placeholder="Sin precio"
                                value={precioTemporal}
                                className={styles.inputPrecio}
                                onChange={(e) => {
                                    if (esEntradaPrecioPublicacion(e.target.value)) setPrecioTemporal(e.target.value);
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
                                {precio === null ? "Sin precio" : `$${precio}`}
                            </button>
                        )}
                        <button type="button" className={styles.botonPrecio} onClick={sumar} disabled={guardandoManual || editandoPrecio || !puedeModificar} aria-label="Aumentar precio">
                            <AddIcon aria-hidden="true" fontSize="inherit" />
                        </button>
                    </div>
                    <button type="button" onClick={consultarPublicacion} className={styles.botonDetalle} aria-label={`Ver detalle de ${nombreProducto}`}>
                        <ChevronRightIcon aria-hidden="true" fontSize="inherit" />
                    </button>
                </div>
                {errorPrecio && <div role="alert" className={styles.errorPrecio}>{errorPrecio}</div>}
            </div>
        </div>
    );
    return contenido;
}
