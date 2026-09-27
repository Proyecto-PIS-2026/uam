"use client";

import { useState } from "react";
import type { Publicacion } from "./mi-mercado";
import Detalle from "./[id]/detalle-publicacion";
import Drawer from "../../../compartido/drawer";
import { actualizarPrecio } from "./actions";

type Props = {
    pub: Publicacion;
    incrementoPrecio: number;
};

export default function TarjetaPublicacion({
    pub,
    incrementoPrecio,
}: Props) {
    let precioInicial = 0;

    if (Number(pub.precio)) {
        precioInicial = Number(pub.precio);
    }

    const [precio, setPrecio] = useState(precioInicial);
    const [estaAbierto, setEstaAbierto] = useState(false);

    const [editandoPrecio, setEditandoPrecio] = useState(false);
    const [precioTemporal, setPrecioTemporal] = useState(
        String(precioInicial)
    );

    function cambiarPrecio(nuevoPrecio: number) {
        if (!Number.isFinite(nuevoPrecio) || nuevoPrecio < 0) {
            return;
        }

        setPrecio(nuevoPrecio);
        actualizarPrecio(pub.id, nuevoPrecio);
    }

    function restar() {
        const nuevoPrecio = Math.max(
            0,
            precio - incrementoPrecio
        );

        cambiarPrecio(nuevoPrecio);
    }

    function sumar() {
        const nuevoPrecio =
            precio + incrementoPrecio;

        cambiarPrecio(nuevoPrecio);
    }

    function comenzarEdicionPrecio() {
        setPrecioTemporal(String(precio));
        setEditandoPrecio(true);
    }

    function guardarPrecioManual() {
        const texto =
            precioTemporal.trim().replace(",", ".");

        if (texto === "") {
            setPrecioTemporal(String(precio));
            setEditandoPrecio(false);
            return;
        }

        const nuevoPrecio = Number(texto);

        if (
            !Number.isFinite(nuevoPrecio) ||
            nuevoPrecio < 0
        ) {
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
        <>
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
                    onClick={() => setEstaAbierto(true)}
                    className="
                        w-28 shrink-0
                        overflow-hidden
                        bg-primary-soft
                        text-left
                        sm:w-32
                        md:aspect-[8/5]
                        md:w-full
                    "
                    aria-label={`Ver detalle de ${nombreProducto}`}
                >
                    {pub.foto ? (
                        <img
                            src={pub.foto}
                            alt={nombreProducto}
                            className="h-full w-full object-cover"
                        />
                    ) : pub.presentacion.variedad.especie
                          .fotoEspecie ? (
                        <img
                            src={
                                pub.presentacion.variedad.especie
                                    .fotoEspecie
                            }
                            alt={especie}
                            className="h-full w-full object-cover opacity-70"
                        />
                    ) : (
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
                    )}
                </button>

                {/* Contenido */}
                <div className="flex min-w-0 flex-1 flex-col">

                    {/* Información clickeable */}
                    <button
                        type="button"
                        onClick={() => setEstaAbierto(true)}
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
                                aria-label="Disminuir precio"
                            >
                                −
                            </button>

                            {editandoPrecio ? (
                                <input
                                    autoFocus
                                    type="text"
                                    inputMode="decimal"
                                    value={precioTemporal}
                                    onChange={(e) =>
                                        setPrecioTemporal(
                                            e.target.value
                                        )
                                    }
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
                                        w-20 rounded-lg
                                        border border-primary
                                        bg-surface
                                        px-2 py-1
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
                                aria-label="Aumentar precio"
                            >
                                +
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setEstaAbierto(true)
                            }
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
                </div>
            </div>

            <Drawer
                isOpen={estaAbierto}
                onClose={() =>
                    setEstaAbierto(false)
                }
            >
                <Detalle
                    pub={pub}
                    precio={precio}
                    restar={restar}
                    sumar={sumar}
                    cambiarPrecio={cambiarPrecio}
                />
            </Drawer>
        </>
    );
}