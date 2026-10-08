"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import type { OperadorParaModificar } from "../../Tipos";
import styles from "./EditarPerfilOperador.module.css";

interface EditarPerfilOperadorProps {
    usuario: OperadorParaModificar;
}

interface Notificacion {
    mensaje: string;
    tipo: "error" | "success";
    key: number;
}

export default function EditarPerfilOperador({ usuario }: EditarPerfilOperadorProps) {
    const [editando, setEditando] = useState(false);
    const [nombreFantasia, setNombreFantasia] = useState(usuario.nombreFantasia);
    const [whatsApp, setWhatsApp] = useState(usuario.whatsApp);
    const [foto, setFoto] = useState<string | null>(usuario.fotoPerfil);
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
    const [notificacion, setNotificacion] = useState<Notificacion | null>(null);

    const inputFotoRef = useRef<HTMLInputElement>(null);
    const urlVistaPreviaRef = useRef<string | null>(null);

    useEffect(() => {
        return () => {
            if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);
        };
    }, []);

    function mostrarNotificacion(mensaje: string, tipo: "error" | "success") {
        setNotificacion({ mensaje, tipo, key: Date.now() });
    }

    function seleccionarFoto(evento: ChangeEvent<HTMLInputElement>) {
        if (!editando) return;
        const archivo = evento.target.files?.[0];
        if (!archivo) return;

        const formatosPermitidos = ["image/jpeg", "image/png", "image/webp"];

        if (!formatosPermitidos.includes(archivo.type) || archivo.size === 0 || archivo.size > 10 * 1024 * 1024) {
            mostrarNotificacion("Seleccioná una imagen JPEG, PNG o WebP de hasta 10 MB.", "error");
            evento.target.value = "";
            return;
        }

        if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);

        const url = URL.createObjectURL(archivo);
        urlVistaPreviaRef.current = url;
        setVistaPrevia(url);
        setNotificacion(null);
        evento.target.value = "";
    }

    function comenzarEdicion() {
        setNotificacion(null);
        setEditando(true);
    }

    function cancelarEdicion() {
        if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);

        urlVistaPreviaRef.current = null;
        setNombreFantasia(usuario.nombreFantasia);
        setWhatsApp(usuario.whatsApp);
        setFoto(usuario.fotoPerfil);
        setVistaPrevia(null);
        setNotificacion(null);
        setEditando(false);

        if (inputFotoRef.current) inputFotoRef.current.value = "";
    }

    function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        const nombreFantasiaNormalizado = nombreFantasia.trim();
        const whatsAppNormalizado = whatsApp.trim();

        if (nombreFantasiaNormalizado === "") {
            mostrarNotificacion("El nombre fantasía es obligatorio.", "error");
            return;
        }

        if (whatsAppNormalizado === "") {
            mostrarNotificacion("El número de WhatsApp es obligatorio.", "error");
            return;
        }

        setNombreFantasia(nombreFantasiaNormalizado);
        setWhatsApp(whatsAppNormalizado);
        setEditando(false);
        mostrarNotificacion("Los cambios fueron validados.", "success");
    }

    const fotoVisible = vistaPrevia ?? foto;

    return (
        <section className={styles.contenedor}>
            <form onSubmit={guardar}>
                <div className={styles.encabezado}>
                    <h3 className={styles.titulo}>Editar perfil</h3>
                    <span className={styles.username}>@{usuario.username}</span>
                </div>

                <div className={styles.contenido}>
                    <div className={styles.columnaFoto}>
                        <div className={styles.seccionFoto}>
                            <div className={styles.marcoFoto}>
                                {fotoVisible ? (
                                    <Image src={fotoVisible} alt={`Foto de perfil de ${usuario.username}`} fill className={styles.imagenFoto} sizes="160px" unoptimized/>
                                ) : (
                                    <div className={styles.sinFoto}>
                                        <span>Sin foto</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <input ref={inputFotoRef} className={styles.inputFoto} type="file" accept="image/jpeg,image/png,image/webp" onChange={seleccionarFoto}/>
                    </div>

                    <div className={styles.detalles}>
                        <TextField fullWidth size="small" label="Nombre fantasía" value={nombreFantasia} disabled={!editando} onChange={(evento) => setNombreFantasia(evento.target.value)} className={styles.campo}/>
                        <TextField fullWidth size="small" label="WhatsApp" value={whatsApp} disabled={!editando} onChange={(evento) => setWhatsApp(evento.target.value)} className={styles.campo}/>
                    </div>

                    <div className={styles.controles}>
                        <div className={styles.controlFoto}>
                            {editando && (
                                <Button type="button" variant="outlined" onClick={() => inputFotoRef.current?.click()} className={styles.botonFoto}> Editar Foto </Button>
                            )}
                        </div>

                        <div className={styles.acciones}>
                            {!editando ? (
                                <Button type="button" variant="outlined" onClick={comenzarEdicion} className={styles.botonEditar}> Editar </Button>
                            ) : (
                                <>
                                    <Button type="button" variant="outlined" onClick={cancelarEdicion} className={styles.botonCancelar}> Cancelar </Button>
                                    <Button type="submit" variant="contained" className={styles.botonGuardar}> Guardar </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </form>

            <Snackbar key={notificacion?.key} open={Boolean(notificacion)} autoHideDuration={4000} onClose={() => 
                setNotificacion(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                {notificacion ? (<Alert onClose={() => setNotificacion(null)} severity={notificacion.tipo} variant="filled" sx={{ width: "100%" }}> {notificacion.mensaje} </Alert>) : undefined}
            </Snackbar>
        </section>
    );
}