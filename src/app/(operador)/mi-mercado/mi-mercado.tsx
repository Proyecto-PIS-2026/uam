"use client";
import Link from "next/link";

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

export default function MiMercado({ publicaciones }: Props) {
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
                                {items.map((pub) => {
                                    const variedad =
                                        pub.presentacion.variedad.nombreVariedad;

                                    const tieneVariedad =
                                        variedad &&
                                        variedad.trim() !== "" &&
                                        variedad.trim() !== "-";

                                    const tienePrecio =
                                        pub.precio &&
                                        pub.precio !== "null" &&
                                        pub.precio !== "undefined";

                                    return (
                                        <Link
                                            key={pub.id}
                                            href={`/mi-mercado/${pub.id}`}
                                            className="flex min-h-28 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                                        >
                                            {/* Foto */}
                                            <div className="w-28 shrink-0 bg-gray-100 sm:w-32">
                                                {pub.foto ? (
                                                    <img
                                                        src={pub.foto}
                                                        alt={`${especie.nombreEspecie}${
                                                            tieneVariedad
                                                                ? ` ${variedad}`
                                                                : ""
                                                        }`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : especie.fotoEspecie ? (
                                                    <img
                                                        src={especie.fotoEspecie}
                                                        alt={especie.nombreEspecie}
                                                        className="h-full w-full object-cover opacity-70"
                                                    />
                                                ) : (
                                                    <div className="flex h-full min-h-28 items-center justify-center px-2 text-center text-xs font-medium text-gray-400">
                                                        Sin fotografía
                                                    </div>
                                                )}
                                            </div>

                                            {/* Información */}
                                            <div className="flex min-w-0 flex-1 flex-col">

                                                {/* Datos principales */}
                                                <div className="flex-1 p-3 sm:p-4">
                                                    <div className="flex items-start justify-between gap-2">

                                                        <div className="min-w-0">
                                                            <h3 className="truncate text-base font-bold text-[var(--ink)] sm:text-lg">
                                                                {
                                                                    especie.nombreEspecie
                                                                }
                                                                {tieneVariedad &&
                                                                    ` · ${variedad}`}
                                                            </h3>

                                                            <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
                                                                {pub.categoria
                                                                    .nombreCategoria ||
                                                                    "-"}{" "}
                                                                ·{" "}
                                                                {pub.calibre
                                                                    .nombreCalibre ||
                                                                    "-"}{" "}
                                                                ·{" "}
                                                                {pub.presentacion
                                                                    .nombrePresentacion ||
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

                                                {/* Precio */}
                                                <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 sm:px-4">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                                            Precio
                                                        </p>

                                                        <p className="text-xl font-extrabold text-[var(--ink)]">
                                                            {tienePrecio
                                                                ? `$${pub.precio}`
                                                                : "Sin precio"}
                                                        </p>
                                                    </div>

                                                    {/* Más adelante:
                                                        acceso al detalle de BP-07.2
                                                    */}
                                                    <span className="text-xl text-[var(--green)]">
                                                        ›
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
}