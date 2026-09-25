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
                <div className="ml-1 relative w-[10rem] h-[10rem] shrink-0 self-center overflow-hidden rounded-[5rem] bg-primary-soft">
                    {foto ? (
                        <img
                            src={foto}
                            alt={especie}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex w-full h-full flex-col items-center justify-center text-muted text-xs font-medium">
                            Sin fotografía
                        </div>
                    )}
                </div>

                {/* Nombre y disponibilidad */}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                        <div className="min-w-0 pt-3">

                            <h2 className="min-w-0 m-1 overflow-hidden text-secondary truncate text-3xl  font-bold leading-[0.7]">
                                {especie}
                                {tieneVariedad && ` · ${variedad}`}
                            </h2>
                        </div>

                        <span
                            className={`w-fit m-1 shrink-0 rounded-full px-4 py-1 text-xs font-bold ${
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

                            <p className="min-w-24 text-center text-2xl font-extrabold text-foreground">
                                {precio === 0
                                    ? "Sin precio"
                                    : `$${precio}`}
                            </p>

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
                    <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-foreground">Presentación</span>
                        <span className="font-bold text-secondary">{presentacion || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-foreground">Calibre</span>
                        <span className="font-bold text-secondary">{calibre || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-foreground">Categoría</span>
                        <span className="font-bold text-secondary">{categoria || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-foreground">Variedad</span>
                        <span className="font-bold text-secondary">{tieneVariedad ? variedad : "Sin variedad"}</span>
                    </div>
                </div>
            </section>

        </div>
    );
}