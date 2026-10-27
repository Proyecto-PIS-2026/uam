"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import UndoIcon from "@mui/icons-material/Undo";
import styles from "./SelectorFotoPerfil.module.css";

export type CambioFotoPerfil = File | null | undefined;

export function argumentosFotoPerfil(cambio: CambioFotoPerfil): [] | [FormData] {
    if (cambio === undefined) return [];
    const datos = new FormData();
    if (cambio === null) datos.set("eliminarFoto", "true");
    else datos.set("fotoPerfil", cambio);
    return [datos];
}

type Props = {
    fotoActual?: string | null;
    cambio: CambioFotoPerfil;
    alCambiar: (cambio: CambioFotoPerfil) => void;
    alError: (mensaje: string) => void;
    deshabilitado?: boolean;
};

export default function SelectorFotoPerfil({ fotoActual, cambio, alCambiar, alError, deshabilitado = false }: Props) {
    const id = useId();
    const entrada = useRef<HTMLInputElement>(null);
    const [vistaPrevia, setVistaPrevia] = useState<{ archivo: File; url: string } | null>(null);
    const [fotoFallida, setFotoFallida] = useState<string | null>(null);
    const archivo = cambio instanceof File ? cambio : null;

    useEffect(() => {
        if (!archivo) return;
        const url = URL.createObjectURL(archivo);
        let activo = true;
        queueMicrotask(() => { if (activo) setVistaPrevia({ archivo, url }); });
        return () => {
            activo = false;
            URL.revokeObjectURL(url);
        };
    }, [archivo]);

    const url = archivo ? vistaPrevia?.archivo === archivo ? vistaPrevia.url : null : cambio === null ? null : fotoActual;
    const hayFoto = Boolean(archivo || cambio !== null && fotoActual);

    function seleccionar(evento: ChangeEvent<HTMLInputElement>) {
        const seleccionada = evento.currentTarget.files?.[0];
        evento.currentTarget.value = "";
        if (deshabilitado || !seleccionada) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(seleccionada.type)) {
            alError("La foto debe ser JPEG, PNG o WebP.");
            return;
        }
        if (seleccionada.size === 0 || seleccionada.size > 10 * 1024 * 1024) {
            alError("La foto debe pesar entre 1 byte y 10 MB.");
            return;
        }
        alCambiar(seleccionada);
    }

    function cambiar(valor: CambioFotoPerfil) {
        if (deshabilitado) return;
        if (entrada.current) entrada.current.value = "";
        alCambiar(valor);
    }

    return <div className={styles.contenedor} role="group" aria-labelledby={`${id}-titulo`}>
        <div className={styles.vistaPrevia}>
            {url && url !== fotoFallida
                ? <Image src={url} alt="Vista previa de la foto de perfil" width={112} height={112} unoptimized className={styles.imagen} onError={() => setFotoFallida(url)} />
                : <PersonOutlineIcon className={styles.sinFoto} aria-hidden="true" />}
        </div>
        <div className={styles.contenido}>
            <p id={`${id}-titulo`} className={styles.titulo}>Foto de perfil <span className={styles.opcional}>(opcional)</span></p>
            <p id={`${id}-ayuda`} className={styles.ayuda}>JPEG, PNG o WebP, hasta 10 MB. Los cambios se aplicarán al guardar.</p>
            <input ref={entrada} id={id} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Seleccionar foto de perfil" aria-describedby={`${id}-ayuda`} onChange={seleccionar} disabled={deshabilitado} hidden />
            <div className={styles.acciones}>
                <button type="button" className="boton-secundario" onClick={() => entrada.current?.click()} disabled={deshabilitado}>
                    <AddPhotoAlternateOutlinedIcon fontSize="small" aria-hidden="true" />{hayFoto ? "Cambiar foto" : "Agregar foto"}
                </button>
                {hayFoto && <button type="button" className={`boton-secundario ${styles.quitar}`} onClick={() => cambiar(fotoActual ? null : undefined)} disabled={deshabilitado}>
                    <DeleteOutlinedIcon fontSize="small" aria-hidden="true" />Quitar foto
                </button>}
                {cambio !== undefined && fotoActual && <button type="button" className="boton-secundario" onClick={() => cambiar(undefined)} disabled={deshabilitado}>
                    <UndoIcon fontSize="small" aria-hidden="true" />Deshacer cambio
                </button>}
            </div>
            {cambio === null && fotoActual && <p className={styles.ayuda} role="status">La foto se eliminará al guardar.</p>}
        </div>
    </div>;
}
