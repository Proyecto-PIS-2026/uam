"use client";

import { useState } from "react";
import TarjetaPublicacion from "./tarjeta-publicacion";

export type Publicacion = {
    id: number;
    foto: string | null;
    precio: string | null;
    publicacionActiva: boolean;
    publicacionDisponible: boolean;
    presentacion: {
        nombrePresentacion: string;
        variedad: {
            nombreVariedad: string;
            especie: {
                id: number;
                nombreEspecie: string;
                fotoEspecie: string | null;
            };
        };
    };
    categoria: {
        nombreCategoria: string;
    };
    calibre: {
        codigoCalibre: string;
        nombreCalibre: string;
    };
};

type Props = {
    publicaciones: Publicacion[];
    incrementoPrecio: number;
};

export default function MiMercado({
    publicaciones,
    incrementoPrecio,
}: Props) {
    const [agruparPorEspecie, setAgruparPorEspecie] = useState(true);

    const gruposPorEspecie = new Map<
        number,
        {
            especie: Publicacion["presentacion"]["variedad"]["especie"];
            items: Publicacion[];
        }
    >();

    for (const pub of publicaciones) {
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

    return (
        <main className="min-h-screen bg-background px-4 py-6 sm:px-8 sm:py-8">
            <div className="mx-auto max-w-7xl">

                {/* Encabezado */}
                <header className="mb-7 overflow-hidden rounded-2xl bg-secondary px-5 py-5 sm:px-7 sm:py-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary-soft">
                                Mis publicaciones
                            </p>

                            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                                Mi Mercado
                            </h1>

                            <p className="mt-2 text-sm text-white/80 sm:text-base">
                                Consultá los productos que tenés publicados.
                            </p>
                        </div>

                        <p className="text-sm font-semibold text-white/80">
                            {publicaciones.length}{" "}
                            {publicaciones.length === 1
                                ? "publicación"
                                : "publicaciones"}
                        </p>
                    </div>
                </header>

                {/* Estado vacío */}
                {publicaciones.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
                        <h2 className="text-xl font-bold text-foreground">
                            No tenés publicaciones
                        </h2>

                        <p className="mt-2 text-sm text-muted">
                            Cuando tengas productos publicados aparecerán acá.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Controles */}
                        <div className="mb-5 flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-xl font-bold text-foreground">
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
                                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                    agruparPorEspecie
                                        ? "border-primary bg-primary text-white"
                                        : "border-border bg-surface text-foreground hover:border-primary"
                                }`}
                            >
                                {agruparPorEspecie
                                    ? "Desagrupar"
                                    : "Agrupar por especie"}
                            </button>
                        </div>

                        {agruparPorEspecie ? (
                            <div className="space-y-7">
                                {grupos.map(({ especie, items }) => (
                                    <section key={especie.id}>

                                        {/* Encabezado de especie */}
                                        <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
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
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                            {items.map((pub) => (
                                                <TarjetaPublicacion
                                                    key={pub.id}
                                                    pub={pub}
                                                    incrementoPrecio={
                                                        incrementoPrecio
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                {publicaciones.map((pub) => (
                                    <TarjetaPublicacion
                                        key={pub.id}
                                        pub={pub}
                                        incrementoPrecio={incrementoPrecio}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}