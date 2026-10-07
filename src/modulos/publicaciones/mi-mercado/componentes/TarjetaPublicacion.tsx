"use client";

import { useRef, useState } from "react";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import type { Publicacion } from "./MiMercado";
import { actualizarPrecio } from "../acciones";
import { obtenerImporteAjusteRapido } from "../../../administracion/acciones-ajuste-precios";

type Props = {
    pub: Publicacion;
    operadorId: number;
    incrementoPrecio: number;
    alConsultar?: (publicacion: Publicacion) => void;
    alPrecioActualizado?: () => void | Promise<Publicacion[] | false>;
    alPublicacionEliminada?: () => void;
};

export default function TarjetaPublicacion({
    pub,
    operadorId,
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
    const [guardandoPrecio, setGuardandoPrecio] = useState(false);
    const [errorPrecio, setErrorPrecio] = useState("");
    const [importeAjuste, setImporteAjuste] = useState(incrementoPrecio);
    const guardandoPrecioRef = useRef(false);

    const [editandoPrecio, setEditandoPrecio] = useState(false);
    const [precioTemporal, setPrecioTemporal] = useState(
        String(precioInicial)
    );

    async function cambiarPrecio(nuevoPrecio: number, direccion?: 1 | -1) {
        if (guardandoPrecioRef.current) return;

        guardandoPrecioRef.current = true;
        setGuardandoPrecio(true);
        setErrorPrecio("");
        try {
            if (direccion !== undefined) {
                const importe = await obtenerImporteAjusteRapido();
                setImporteAjuste(importe);
                nuevoPrecio = Math.max(0, precio + direccion * importe);
            }
            if (!Number.isFinite(nuevoPrecio) || nuevoPrecio <= 0) {
                setErrorPrecio("El precio debe ser un número mayor a cero.");
                return;
            }
            if (!Number.isInteger(nuevoPrecio)) {
                setErrorPrecio("El precio debe ser un número entero, sin decimales.");
                return;
            }
            await actualizarPrecio(pub.id, nuevoPrecio, operadorId);
            const resultado = await actualizarPrecio(pub.id, nuevoPrecio, operadorId);
            if (resultado?.publicacionEliminada) {
                alPublicacionEliminada?.();
                return;
            }
            setPrecioGuardado({ base: pub.precio, valor: nuevoPrecio });
            alPrecioActualizado?.();
        } catch (error) {
            console.error("No se pudo guardar el precio de la publicación:", error);
            setErrorPrecio("No se pudo guardar el precio. Intentá de nuevo.");
        } finally {
            guardandoPrecioRef.current = false;
            setGuardandoPrecio(false);
        }
    }

    function consultarPublicacion() {
        if (guardandoPrecioRef.current) return;
        alConsultar?.({ ...pub, precio: pub.precio === null && precio === 0 ? null : String(precio) });
    }

    function restar() {
        void cambiarPrecio(precio, -1);
    }

    function sumar() {
        void cambiarPrecio(precio, 1);
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

        if (
            !Number.isInteger(nuevoPrecio) ||
            nuevoPrecio <= 0 ||
            nuevoPrecio === precio
        ) {
            setPrecioTemporal(String(precio));
            setEditandoPrecio(false);
            return;
        }

        void cambiarPrecio(nuevoPrecio);
        setEditandoPrecio(false);
    }

    function cancelarEdicionPrecio() {
        setPrecioTemporal(String(precio));
        setEditandoPrecio(false);
    }

    const variedad =
        pub.presentacion.variedad.nombreVariedad;

    const especie =
        pub.presentacion.variedad.especie.nombreEspecie;

    const presentacion =
        pub.presentacion.nombrePresentacion;

    const categoria =
        pub.categoria.nombreCategoria;

    const calibre =
        pub.calibre.nombreCalibre;

    const tieneVariedad =
        variedad &&
        variedad.trim() !== "" &&
        variedad.trim() !== "-";

    const nombreProducto = tieneVariedad
        ? `${especie} · ${variedad}`
        : especie;

    return (
            <div
                className="
                    flex min-h-28 overflow-hidden
                    rounded-2xl border border-border
                    bg-surface shadow-sm

                    md:min-h-0
                    md:flex-col
                    md:transition-all
                    md:duration-150
                    md:hover:-translate-y-0.5
                    md:hover:border-primary
                    md:hover:shadow-md
                "
            >
                {/* Foto */}
                <button
                    type="button"
                    onClick={consultarPublicacion}
                    className="
                        relative w-28 shrink-0
                        overflow-hidden
                        bg-primary-soft
                        text-left
                        sm:w-32
                        md:aspect-[8/5]
                        md:w-full
                    "
                    aria-label={`Ver detalle de ${nombreProducto}`}
                >
                    <ImagenPublicacion src={pub.foto} alt={nombreProducto} fill sizes="(min-width: 768px) 320px, 128px" unoptimized className="h-full w-full object-cover" reemplazo={
                        <div
                            className="
                                flex h-full min-h-28
                                items-center justify-center
                                bg-primary-soft
                                px-2 text-center
                                text-xs font-medium
                                text-secondary
                            "
                        >
                            Sin fotografía
                        </div>
                    } />
                </button>

                {/* Contenido */}
                <div className="flex min-w-0 flex-1 flex-col">

                    {/* Información clickeable */}
                    <button
                        type="button"
                        onClick={consultarPublicacion}
                        className="
                            flex min-w-0 flex-1
                            text-left
                            hover:bg-primary-soft/30
                        "
                    >
                        <div
                            className="
                                flex min-w-0 flex-1
                                flex-col p-3
                                sm:p-4
                                md:p-3
                            "
                        >
                            {/* Nombre + estado */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                                <h3
                                    className="
                                        min-w-0 flex-1
                                        text-base font-bold
                                        leading-tight
                                        text-foreground
                                        md:text-[1rem]
                                    "
                                    title={nombreProducto}
                                >
                                    {nombreProducto}
                                </h3>

                                <span
                                    className={`
                                        w-fit shrink-0 rounded-full
                                        px-2 py-1
                                        text-[10px] font-bold
                                        ${
                                            pub.publicacionDisponible
                                                ? "bg-primary-soft text-secondary"
                                                : "bg-gray-100 text-muted"
                                        }
                                    `}
                                >
                                    {pub.publicacionDisponible
                                        ? "Disponible"
                                        : "No disponible"}
                                </span>
                            </div>

                            {/* Datos */}
                            <p className="mt-2 text-xs leading-5 text-muted">
                                {calibre || "-"}
                                {" · "}
                                Cat. {categoria || "-"}
                                {" · "}
                                {presentacion || "-"}
                            </p>
                        </div>
                    </button>

                    {/* Precio */}
                    <div
                        className="
                            flex items-center
                            justify-between
                            border-t border-border
                            px-3 py-2.5
                        "
                    >
                        <div className="flex items-center gap-2">

                            <button
                                type="button"
                                className="
                                    flex h-8 w-8
                                    items-center justify-center
                                    rounded-lg
                                    bg-secondary
                                    text-xl font-bold
                                    text-white
                                    transition
                                    hover:bg-primary-hover
                                "
                                onClick={restar}
                                disabled={guardandoPrecio}
                                aria-label="Disminuir precio"
                                title={`Disminuir $${importeAjuste}`}
                            >
                                −
                            </button>

                            {editandoPrecio ? (
                                <input
                                    autoFocus
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={precioTemporal}
                                    onChange={(e) => {
                                        if (/^\d{0,10}$/.test(e.target.value)) setPrecioTemporal(e.target.value);
                                    }}
                                    onBlur={
                                        guardarPrecioManual
                                    }
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
                                    className="
                                        box-border h-8 w-20 rounded-lg
                                        border border-primary
                                        bg-surface
                                        px-2 py-0
                                        text-center
                                        text-lg font-extrabold
                                        text-foreground
                                        outline-none
                                        focus:ring-2
                                        focus:ring-primary/20
                                    "
                                    aria-label="Editar precio"
                                />
                            ) : (
                                <button
                                    type="button"
                                    onClick={
                                        comenzarEdicionPrecio
                                    }
                                    disabled={guardandoPrecio}
                                    className="
                                        min-w-16
                                        cursor-text
                                        text-center
                                        text-xl font-extrabold
                                        text-foreground
                                        hover:underline
                                    "
                                    title="Editar precio"
                                >
                                    {precio === 0
                                        ? "Sin precio"
                                        : `$${precio}`}
                                </button>
                            )}

                            <button
                                type="button"
                                className="
                                    flex h-8 w-8
                                    items-center justify-center
                                    rounded-lg
                                    bg-secondary
                                    text-xl font-bold
                                    text-white
                                    transition
                                    hover:bg-primary-hover
                                "
                                onClick={sumar}
                                disabled={guardandoPrecio}
                                aria-label="Aumentar precio"
                                title={`Aumentar $${importeAjuste}`}
                            >
                                +
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={consultarPublicacion}
                            className="
                                text-xl font-bold
                                text-secondary
                                hover:text-primary
                            "
                            aria-label={`Ver detalle de ${nombreProducto}`}
                        >
                            ›
                        </button>
                    </div>
                    {errorPrecio && <p role="alert" className="px-3 pb-3 text-sm text-red-800">{errorPrecio}</p>}
                </div>
            </div>

    );
}
