"use client";

import { useRef, useState } from "react";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import type { Publicacion } from "./MiMercado";
import { actualizarPrecio } from "../acciones";
import styles from "./TarjetaPublicacion.module.css";

type Props = {
    pub: Publicacion;
    operadorId: number;
    puedeModificar: boolean;
    incrementoPrecio: number;
    alConsultar?: (publicacion: Publicacion) => void;
    alPrecioActualizado?: (publicacionId: number, nuevoPrecio: number) => void;
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
    let precioInicial = 0;
    if (Number(pub.precio)) {
        precioInicial = Number(pub.precio);
    }
    const [precioGuardado, setPrecioGuardado] = useState({ base: pub.precio, valor: precioInicial });
    const precio = precioGuardado.base === pub.precio ? precioGuardado.valor : precioInicial;
    const [errorPrecio, setErrorPrecio] = useState("");
    const precioPendienteRef = useRef(precioInicial);
    const precioConfirmadoRef = useRef(precioInicial);
    const guardandoPrecioRef = useRef(false);
    const [guardandoPrecio, setGuardandoPrecio] = useState(false);
    const [editandoPrecio, setEditandoPrecio] = useState(false);
    const [precioTemporal, setPrecioTemporal] = useState(String(precioInicial));

    async function guardarPrecioPendiente() {
        if (guardandoPrecioRef.current) {
            return;
        }
        guardandoPrecioRef.current = true;
        setGuardandoPrecio(true);
        try {
            while (precioPendienteRef.current !== precioConfirmadoRef.current) {
                const precioAGuardar =precioPendienteRef.current;
                try {
                    const resultado = await actualizarPrecio(pub.id, precioAGuardar, operadorId);
                    if (resultado?.publicacionEliminada) {
                        alPublicacionEliminada?.();
                        return;
                    }
                    precioConfirmadoRef.current = precioAGuardar;
                    if (precioPendienteRef.current === precioAGuardar) {
                        alPrecioActualizado?.(pub.id, precioAGuardar);
                    }
                    setErrorPrecio("");
                } catch (error) {
                    const precioAnterior = precioConfirmadoRef.current;
                    precioPendienteRef.current = precioAnterior;
                    setPrecioGuardado({ base: pub.precio, valor: precioAnterior });
                    alPrecioActualizado?.(pub.id, precioAnterior);
                    setErrorPrecio(error instanceof Error ? error.message : "No se pudo guardar el precio.");
                    break;
                }
            }
        } finally {
            guardandoPrecioRef.current = false;
            setGuardandoPrecio(false);
        }
    }

    function cambiarPrecio(nuevoPrecio: number) {
        if (!Number.isFinite(nuevoPrecio) || nuevoPrecio <= 0) {
            setErrorPrecio("El precio debe ser un número mayor a cero.");
            return;
        }
        if (!Number.isInteger(nuevoPrecio)) {
            setErrorPrecio("El precio debe ser un número entero, sin decimales.");
            return;
        }
        setErrorPrecio("");
        precioPendienteRef.current = nuevoPrecio;
        setPrecioGuardado({  base: pub.precio, valor: nuevoPrecio });
        void guardarPrecioPendiente();
    }

    function consultarPublicacion() {
        alConsultar?.({ ...pub, precio: pub.precio === null && precio === 0 ? null : String(precio)});
    }

    function restar() {
        const nuevoPrecio = precioPendienteRef.current - incrementoPrecio;
        if (nuevoPrecio <= 0) {
            return;
        }
        cambiarPrecio(nuevoPrecio);
    }

    function sumar() {
        const nuevoPrecio = precioPendienteRef.current + incrementoPrecio;
        cambiarPrecio(nuevoPrecio);
    }

    function comenzarEdicionPrecio() {
        setPrecioTemporal(String(precio));
        setEditandoPrecio(true);
    }

    function guardarPrecioManual() {
        const texto = precioTemporal.trim();
        if (texto === "") {
            setPrecioTemporal(String(precio));
            setEditandoPrecio(false);
            return;
        }
        const nuevoPrecio = Number(texto);
        if (!Number.isInteger(nuevoPrecio) || nuevoPrecio <= 0 || nuevoPrecio === precio) {
            setPrecioTemporal(String(precio));
            setEditandoPrecio(false);
            return;
        }
        cambiarPrecio(nuevoPrecio);
        setEditandoPrecio(false);
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
                <ImagenPublicacion src={pub.foto} alt={nombreProducto} fill sizes="(min-width: 768px) 320px, 128px" unoptimized className={styles.foto} reemplazo={<div className={styles.sinFoto}>Sin fotografía</div>} />
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
                        <button type="button" className={styles.botonPrecio} onClick={restar} disabled={guardandoPrecio || !puedeModificar} aria-label="Disminuir precio">
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
                        <button type="button" className={styles.botonPrecio} onClick={sumar} disabled={guardandoPrecio || !puedeModificar} aria-label="Aumentar precio">
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
    return contenido; 
}
