"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { esDispositivoMovil } from "@/compartido/whatsapp";
import { crearEnlaceWhatsApp, crearMensajeWhatsApp } from "./enlace-whatsapp";
import type { Publicacion } from "./tipos";

type SolicitudFoto = { id: number | undefined; url: string | null | undefined };

type FotoPreparada = {
    solicitud: SolicitudFoto;
    archivo: File | null;
    error: boolean;
};

export function useCompartirPublicacion(
    publicacion: Publicacion | null,
    nombreOperador: string,
    notificar: (mensaje: string, tipo: "error" | "warning") => void,
) {
    const [fotoPreparada, setFotoPreparada] = useState<FotoPreparada | null>(null);
    const [compartiendo, setCompartiendo] = useState(false);
    const enCurso = useRef(false);
    const nativo = esDispositivoMovil() && typeof navigator.share === "function";
    const admiteArchivos = nativo && typeof navigator.canShare === "function";
    const id = publicacion?.id;
    const foto = publicacion?.foto;
    const solicitudFoto = useMemo(() => ({ id, url: foto }), [id, foto]);
    const vigente = fotoPreparada?.solicitud === solicitudFoto ? fotoPreparada : null;
    const preparandoFoto = Boolean(admiteArchivos && foto && !vigente);

    useEffect(() => {
        if (!admiteArchivos || solicitudFoto.id === undefined || !solicitudFoto.url) return;
        const controlador = new AbortController();
        const limite = setTimeout(() => {
            controlador.abort();
            setFotoPreparada({ solicitud: solicitudFoto, archivo: null, error: true });
        }, 30_000);
        async function preparar(id: number, url: string) {
            try {
                const respuesta = await fetch(url, { signal: controlador.signal });
                if (!respuesta.ok) throw new Error("No se pudo obtener la fotografía.");
                const contenido = await respuesta.blob();
                const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[contenido.type];
                if (!extension || contenido.size === 0) throw new Error("La fotografía no es válida.");
                const archivo = new File([contenido], `publicacion-${id}.${extension}`, { type: contenido.type });
                if (!controlador.signal.aborted) setFotoPreparada({ solicitud: solicitudFoto, archivo, error: false });
            } catch {
                if (!controlador.signal.aborted) setFotoPreparada({ solicitud: solicitudFoto, archivo: null, error: true });
            } finally {
                clearTimeout(limite);
            }
        }
        void preparar(solicitudFoto.id, solicitudFoto.url);
        return () => { clearTimeout(limite); controlador.abort(); };
    }, [admiteArchivos, solicitudFoto]);

    async function compartir() {
        if (!publicacion || preparandoFoto || enCurso.current) return;
        enCurso.current = true;
        setCompartiendo(true);
        try {
            if (!nativo) {
                window.open(crearEnlaceWhatsApp(publicacion, nombreOperador, window.location.origin), "_blank", "noopener,noreferrer");
                return;
            }
            if (foto && vigente?.error) {
                notificar("No se pudo cargar la foto para compartir. Volvé a abrir la publicación e intentá nuevamente.", "error");
                return;
            }
            const datos: ShareData = { text: crearMensajeWhatsApp(publicacion, nombreOperador, window.location.origin) };
            if (vigente?.archivo && navigator.canShare({ files: [vigente.archivo] })) {
                datos.files = [vigente.archivo];
            }
            await navigator.share(datos);
            if (foto && !datos.files?.length) {
                notificar("Se compartió solo el texto porque este navegador no permite adjuntar la foto.", "warning");
            }
        } catch (error) {
            const cancelado = typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
            if (!cancelado) {
                notificar(nativo ? "No se pudo compartir la publicación. Intentá nuevamente." : "No se pudo abrir WhatsApp.", "error");
            }
        } finally {
            enCurso.current = false;
            setCompartiendo(false);
        }
    }

    return { compartir, preparandoFoto, compartiendo };
}
