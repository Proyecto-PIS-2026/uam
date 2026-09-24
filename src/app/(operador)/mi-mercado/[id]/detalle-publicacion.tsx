"use client";

import type { Publicacion } from "../mi-mercado";

type Props = {
    pub: Publicacion;
    precio: number;
    restar: () => void;
    sumar: () => void;
};

export default function DetallePublicacion({
    pub,
    precio,
    restar,
    sumar,
}: Props) {
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

    return (
        <div className="space-y-6">

            {/* Encabezado */}
            <div className="flex gap-4">

                {/* Foto */}
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
                    {foto ? (
                        <img
                            src={foto}
                            alt={especie}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted">
                            Sin fotografía
                        </div>
                    )}
                </div>

                {/* Nombre y disponibilidad */}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary">
                                Publicación
                            </p>

                            <h2 className="mt-1 text-3xl font-extrabold text-foreground">
                                {especie}
                                {tieneVariedad && ` · ${variedad}`}
                            </h2>
                        </div>

                        <span
                            className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
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
                </div>
            </div>

            {/* Datos de la publicación */}
            <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
                    Datos de la publicación
                </h3>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                    <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-xs font-semibold text-muted">
                            Categoría
                        </p>

                        <p className="mt-1 font-bold text-foreground">
                            {categoria || "-"}
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-xs font-semibold text-muted">
                            Calibre
                        </p>

                        <p className="mt-1 font-bold text-foreground">
                            {calibre || "-"}
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-xs font-semibold text-muted">
                            Presentación
                        </p>

                        <p className="mt-1 font-bold text-foreground">
                            {presentacion || "-"}
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-xs font-semibold text-muted">
                            Variedad
                        </p>

                        <p className="mt-1 font-bold text-foreground">
                            {tieneVariedad
                                ? variedad
                                : "Sin variedad"}
                        </p>
                    </div>

                </div>
            </section>

            {/* Precio */}
            <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
                    Precio
                </h3>

                <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">

                    <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-xl font-bold text-white"
                        onClick={restar}
                        aria-label="Disminuir precio"
                    >
                        −
                    </button>

                    <p className="min-w-24 text-center text-2xl font-extrabold text-foreground">
                        {precio === 0
                            ? "Sin precio"
                            : `$${precio}`}
                    </p>

                    <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-xl font-bold text-white"
                        onClick={sumar}
                        aria-label="Aumentar precio"
                    >
                        +
                    </button>

                </div>
            </section>

        </div>
    );
}