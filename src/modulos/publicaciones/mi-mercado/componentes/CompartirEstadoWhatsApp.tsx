"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import type { Publicacion } from "./MiMercado";

type Props = {
    publicacion: Publicacion;
    nombreOperador: string;
    alCerrar: () => void;
};

export default function CompartirEstadoWhatsApp({
    publicacion,
    nombreOperador,
    alCerrar,
}: Props) {
    const especie = publicacion.presentacion.variedad.especie.nombreEspecie;
    const variedad = publicacion.presentacion.variedad.nombreVariedad;
    const nombreProducto =
        variedad && variedad !== "-"
            ? `${especie} - ${variedad}`
            : especie;

    const enlacePerfil =
        typeof window !== "undefined"
            ? `${window.location.origin}/operadores/${encodeURIComponent(nombreOperador)}`
            : "";

    const [mensaje, setMensaje] = useState(() =>
        [
            `🌿 ${nombreProducto}`,
            `📦 Presentación: ${publicacion.presentacion.nombrePresentacion}`,
            `🏷️ Categoría: ${publicacion.categoria.nombreCategoria}`,
            `📏 Calibre: ${publicacion.calibre.nombreCalibre}`,
            `💰 Precio: ${publicacion.precio !== null ? `$${Number(publicacion.precio)}` : "Consultar"}`,
            "",
            `Disponible en ${nombreOperador}`,
            `🔗 ${enlacePerfil}`,
        ].join("\n")
    );

    const [error, setError] = useState("");
    const [compartiendo, setCompartiendo] = useState(false);

    async function compartir() {
        setError("");
        setCompartiendo(true);

        try {
            if (!navigator.share) {
                setError("Este navegador no permite compartir directamente. Copiá el texto y abrí la foto para publicarlos manualmente en WhatsApp.");
                return;
            }

            let archivo: File | undefined;

            if (publicacion.foto) {
                try {
                    const respuesta = await fetch(publicacion.foto);

                    if (!respuesta.ok) {
                        throw new Error("No se pudo obtener la fotografía.");
                    }

                    const blob = await respuesta.blob();

                    if (!blob.type.startsWith("image/")) {
                        throw new Error("El archivo no es una imagen.");
                    }

                    archivo = new File(
                        [blob],
                        `producto-${publicacion.id}.png`,
                        { type: blob.type }
                    );
                } catch {
                    setError("No se pudo adjuntar la fotografía automáticamente. Podés abrirla y guardarla manualmente.");
                    return;
                }
            }

            if (archivo) {
                if (!navigator.canShare?.({ files: [archivo] })) {
                    setError("Este dispositivo no admite compartir la fotografía desde el navegador. Podés guardarla manualmente.");
                    return;
                }

                await navigator.share({
                    text: mensaje,
                    files: [archivo],
                });
            } else {
                await navigator.share({ text: mensaje });
            }
        } catch (error) {
            if (error instanceof Error && error.name !== "AbortError") {
                setError("No se pudo compartir el producto.");
            }
        } finally {
            setCompartiendo(false);
        }
    }

    async function copiarMensaje() {
        try {
            await navigator.clipboard.writeText(mensaje);
            setError("Texto copiado al portapapeles.");
        } catch {
            setError("No se pudo copiar el texto.");
        }
    }

    return (
        <Dialog open onClose={alCerrar} fullWidth maxWidth="sm">
            <div className="flex flex-col gap-4 p-6">
                <h2 className="text-xl font-bold">
                    Compartir producto en WhatsApp
                </h2>

                {publicacion.foto && (
                    <div className="relative h-48 w-full overflow-hidden rounded-lg">
                        <ImagenPublicacion
                            src={publicacion.foto}
                            alt={nombreProducto}
                            fill
                            sizes="500px"
                            className="object-contain"
                            reemplazo={<div>Imagen no disponible</div>}
                        />
                    </div>
                )}

                <label htmlFor="mensaje-compartir" className="font-semibold">
                    Editá el texto que querés compartir
                </label>

                <textarea
                    id="mensaje-compartir"
                    value={mensaje}
                    onChange={(evento) => setMensaje(evento.target.value)}
                    rows={9}
                    className="w-full rounded-lg border border-gray-300 p-3 text-sm"
                />

                {error && (
                    <p role="status" className="text-sm">
                        {error}
                    </p>
                )}

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => void compartir()}
                        disabled={compartiendo}
                        className="rounded-lg bg-green-700 px-4 py-2 text-white"
                    >
                        {compartiendo ? "Preparando..." : "Compartir"}
                    </button>

                    <button
                        type="button"
                        onClick={() => void copiarMensaje()}
                        className="rounded-lg border px-4 py-2"
                    >
                        Copiar texto
                    </button>

                    {publicacion.foto && (
                        <a
                            href={publicacion.foto}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border px-4 py-2"
                        >
                            Abrir foto
                        </a>
                    )}

                    <button
                        type="button"
                        onClick={alCerrar}
                        className="rounded-lg border px-4 py-2"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </Dialog>
    );
}