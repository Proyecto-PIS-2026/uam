"use client";

import { useState } from "react";
import type { Publicacion } from "../mi-mercado";

type Props = {
    pub: Publicacion;
    precio: number;
    restar: () => void;
    sumar: () => void;
    cambiarPrecio: (nuevoPrecio: number) => void;
};

export default function DetallePublicacion({
    pub,
    precio,
    restar,
    sumar,
    cambiarPrecio,
}: Props) {
    const [editandoPrecio, setEditandoPrecio] =
        useState(false);

    const [precioTemporal, setPrecioTemporal] =
        useState(String(precio));

    const especie =
        pub.presentacion.variedad.especie.nombreEspecie;

    const variedad =
        pub.presentacion.variedad.nombreVariedad;

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

    const foto =
        pub.foto ||
        pub.presentacion.variedad.especie.fotoEspecie;

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

    return (
        <div className="space-y-6">

            {/* Encabezado */}
            <div className="flex gap-4">

                {/* Foto */}
                <div className="relative ml-1 h-40 w-40 shrink-0 self-center overflow-hidden rounded-full bg-primary-soft">
                    {foto ? (
                        <img
                            src={foto}
                            alt={especie}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted">
                            Sin fotografía
                        </div>
                    )}
                </div>

                {/* Información */}
                <div className="min-w-0 flex-1">

                    <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0 pt-2">
                            <h2 className="text-3xl font-bold leading-tight text-secondary">
                                {especie}
                            </h2>

                            {tieneVariedad && (
                                <p className="mt-1 text-xl font-semibold leading-tight text-secondary">
                                    {variedad}
                                </p>
                            )}
                        </div>

                        <span
                            className={`mt-1 w-fit shrink-0 rounded-full px-4 py-1 text-xs font-bold ${
                                pub.publicacionDisponible
                                    ? "bg-primary-soft text-secondary"
                                    : "bg-gray-100 text-muted"
                            }`}
                        >
                            {pub.publicacionDisponible
                                ? "Disponible"
                                : "No disponible"}
                        </span>
                    </div>

                    {/* Precio */}
                    <section className="pt-4">
                        <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface p-2">

                            <button
                                type="button"
                                className="flex h-10 w-14 items-center justify-center rounded-lg bg-secondary text-xl font-bold text-white"
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
                                        w-24 rounded-lg
                                        border border-primary
                                        bg-surface
                                        px-2 py-1
                                        text-center
                                        text-2xl font-extrabold
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
                                        min-w-24
                                        cursor-text
                                        text-center
                                        text-2xl font-extrabold
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
                                className="flex h-10 w-14 items-center justify-center rounded-lg bg-secondary text-xl font-bold text-white"
                                onClick={sumar}
                                aria-label="Aumentar precio"
                            >
                                +
                            </button>
                        </div>
                    </section>
                </div>
            </div>

            {/* Datos de la publicación */}
            <section className="pb-4">
                <div className="divide-y divide-border rounded-xl border border-border bg-surface">

                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-sm text-foreground">
                            Presentación
                        </span>
                        <span className="text-right font-bold text-secondary">
                            {presentacion || "-"}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-sm text-foreground">
                            Calibre
                        </span>
                        <span className="text-right font-bold text-secondary">
                            {calibre || "-"}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-sm text-foreground">
                            Categoría
                        </span>
                        <span className="text-right font-bold text-secondary">
                            {categoria || "-"}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-sm text-foreground">
                            Variedad
                        </span>
                        <span className="text-right font-bold text-secondary">
                            {tieneVariedad
                                ? variedad
                                : "Sin variedad"}
                        </span>
                    </div>
                </div>
            </section>
        </div>
    );
}