"use client";

import { useState } from "react";
import Link from "next/link";
import type { Publicacion } from "./mi-mercado";
import Precio from "./precio";

type Props = {
    pub: Publicacion;
    incrementoPrecio: number;
};

export default function TarjetaPublicacion({ pub, incrementoPrecio }: Props) {
    let precioInicial = 0;
    if (Number(pub.precio)) {
        precioInicial = Number(pub.precio);
    }
    const [precio, setPrecio] = useState(precioInicial);
    function restar() {
        setPrecio((valorActual) => Math.max(0, valorActual - incrementoPrecio));
    }

    function sumar() {
        setPrecio((valorActual) => valorActual + incrementoPrecio);
    }

    const variedad = pub.presentacion.variedad.nombreVariedad;
    const especie = pub.presentacion.variedad.especie.nombreEspecie;
    const presentacion = pub.presentacion.nombrePresentacion;
    const categoria = pub.categoria.nombreCategoria;
    const calibre = pub.calibre.nombreCalibre;

    const tieneVariedad =
        pub.presentacion.variedad.nombreVariedad &&
        pub.presentacion.variedad.nombreVariedad.trim() !== "" &&
        pub.presentacion.variedad.nombreVariedad.trim() !== "-";


    const detalle = [
    especie,
    tieneVariedad ? variedad : null,
    presentacion,
    categoria ? `Cat. ${categoria}` : null,
    calibre,
    ]
    .filter(Boolean)
    .join(" · ");


    return (
        <div className="flex min-h-28 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {/* Foto */}
            <div className="w-28 shrink-0 bg-gray-100 sm:w-32">
                {pub.foto ? (
                    <img
                        src={pub.foto}
                        alt={`${especie}${
                            tieneVariedad
                                ? ` ${variedad}`
                                : ""
                        }`}
                        className="h-full w-full object-cover"
                    />
                ) : pub.presentacion.variedad.especie.fotoEspecie ? (
                    <img
                        src={pub.presentacion.variedad.especie.fotoEspecie}
                        alt={especie}
                        className="h-full w-full object-cover opacity-70"
                    />
                ) : (
                    <div className="flex h-full min-h-28 items-center justify-center px-2 text-center text-xs font-medium text-gray-400">
                        Sin fotografía
                    </div>
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
                <Link
                    href={`/mi-mercado/${pub.id}`}
                    className="flex min-w-0 flex-1 hover:bg-gray-50"
                >
                    {/* Información */}
                    <div className="flex min-w-0 flex-1 flex-col">

                        {/* Datos principales */}
                        <div className="flex-1 p-3 sm:p-4">
                            <div className="flex items-start justify-between gap-2">

                                <div className="min-w-0">
                                    <h3 className="truncate text-base font-bold text-[var(--ink)] sm:text-lg">
                                        {especie}
                                        {tieneVariedad &&
                                            ` · ${variedad}`}
                                    </h3>

                                    <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
                                        Cat {categoria ||
                                            "-"}{" "}
                                        ·{" "}
                                        {calibre ||
                                            "-"}{" "}
                                        ·{" "}
                                        {presentacion ||
                                            "-"}
                                    </p>
                                </div>

                                <span
                                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold sm:text-xs ${
                                        pub.publicacionDisponible
                                            ? "bg-green-50 text-[var(--green)]"
                                            : "bg-gray-100 text-gray-500"
                                    }`}
                                >
                                    {pub.publicacionDisponible
                                        ? "Disponible"
                                        : "No disponible"}
                                </span>
                            </div>
                        </div>
                    </div>
                </Link>

                {/* Precio */}
                <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 sm:px-4">
                    <Precio
                        id={pub.id}
                        precioInicial={precioInicial}
                        incrementoPrecio={incrementoPrecio}
                        detalle={detalle}
                    />

                    {/* Más adelante:
                        acceso al detalle de BP-07.2
                    */}
                    <span className="text-xl text-[var(--green)]">
                        ›
                    </span>
                </div>
            </div>
        </div>
    );
}