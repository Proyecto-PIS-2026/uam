"use client";

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

export default function MiMercado({ publicaciones , incrementoPrecio }: Props) {
    const gruposPorEspecie = new Map<
        number,
        {
            especie: Publicacion["presentacion"]["variedad"]["especie"];
            items: Publicacion[];
        }
    >();

    // Se mantiene el agrupamiento por especie realizado originalmente.
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
        <main className="min-h-screen bg-[var(--lightgray)] px-4 py-6 sm:px-8 sm:py-8">
            <div className="mx-auto max-w-7xl">

                {/* Encabezado */}
                <header className="mb-7">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--lightgreen)]">
                                Mis publicaciones
                            </p>

                            <h1 className="text-4xl font-extrabold tracking-tight text-[var(--ink)] sm:text-5xl">
                                Mi Mercado
                            </h1>

                            <p className="mt-2 text-sm text-gray-500 sm:text-base">
                                Consultá los productos que tenés publicados.
                            </p>
                        </div>

                        <p className="text-sm font-semibold text-gray-500">
                            {publicaciones.length}{" "}
                            {publicaciones.length === 1
                                ? "publicación"
                                : "publicaciones"}
                        </p>
                    </div>
                </header>

                {/* Estado vacío */}
                {grupos.length === 0 && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                        <h2 className="text-xl font-bold text-[var(--ink)]">
                            No tenés publicaciones
                        </h2>

                        <p className="mt-2 text-sm text-gray-500">
                            Cuando tengas productos publicados aparecerán acá.
                        </p>
                    </div>
                )}

                {/* Publicaciones agrupadas por especie */}
                <div className="space-y-7">
                    {grupos.map(({ especie, items }) => (
                        <section key={especie.id}>

                            {/* Encabezado de especie */}
                            <div className="mb-3 flex items-center gap-2 border-b border-gray-200 pb-2">
                                <h2 className="text-xl font-bold text-[var(--ink)]">
                                    {especie.nombreEspecie}
                                </h2>

                                <span className="text-sm text-gray-400">
                                    · {items.length}{" "}
                                    {items.length === 1
                                        ? "publicación"
                                        : "publicaciones"}
                                </span>
                            </div>

                            {/* Tarjetas */}
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                {items.map((pub) => (
                                    <TarjetaPublicacion key={pub.id} pub={pub} incrementoPrecio={incrementoPrecio}/>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
}