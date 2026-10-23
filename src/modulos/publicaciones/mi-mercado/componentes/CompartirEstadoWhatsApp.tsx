"use client";

import { useState } from "react";
import NotificacionToast, { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import Dialog from "@mui/material/Dialog";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import type { Publicacion } from "../tipos";

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

    const { notificacion, notificar, cerrarNotificacion } = useNotificacionToast();
    const [error, setError] = useState("");
    const [compartiendo, setCompartiendo] = useState(false);

    async function compartir() {
        cerrarNotificacion();
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
                notificar("No se pudo compartir el producto.", "error");
            }
        } finally {
            setCompartiendo(false);
        }
    }

    async function copiarMensaje() {
        cerrarNotificacion();
        try {
            await navigator.clipboard.writeText(mensaje);
            notificar("Texto copiado al portapapeles.", "success");
        } catch {
            notificar("No se pudo copiar el texto.", "error");
        }
    }

    return (
        <>
        <Dialog open onClose={alCerrar} fullWidth maxWidth="sm">
            <div className="secciones-pagina p-[var(--padding-panel)]">
                <h2 className="titulo-seccion">
                    Compartir producto en WhatsApp
                </h2>

                {publicacion.foto && (
                    <div className="relative h-48 w-full overflow-hidden rounded-[var(--radio-panel)]">
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

                <label htmlFor="mensaje-compartir" className="text-[length:var(--tamano-texto-secundario)] font-semibold">
                    Editá el texto que querés compartir
                </label>

                <textarea
                    id="mensaje-compartir"
                    value={mensaje}
                    onChange={(evento) => setMensaje(evento.target.value)}
                    rows={9}
                    className="campo-formulario"
                />

                {error && (
                    <p role="status" className="text-[length:var(--tamano-texto-secundario)] text-muted">
                        {error}
                    </p>
                )}

                <div className="flex flex-wrap gap-[var(--espacio-inline)]">
                    <button
                        type="button"
                        onClick={() => void compartir()}
                        disabled={compartiendo}
                        className="boton-primario"
                    >
                        {compartiendo ? "Preparando..." : "Compartir"}
                    </button>

                    <button
                        type="button"
                        onClick={() => void copiarMensaje()}
                        className="boton-secundario"
                    >
                        Copiar texto
                    </button>

                    {publicacion.foto && (
                        <a
                            href={publicacion.foto}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="boton-secundario"
                        >
                            Abrir foto
                        </a>
                    )}

                    <button
                        type="button"
                        onClick={alCerrar}
                        className="boton-secundario"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </Dialog>
        <NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} />
        </>
    );
}
