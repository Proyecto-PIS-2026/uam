"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import type { OperadorParaModificar } from "../../Compartidos/Tipos";

import Image from "next/image";

interface EditarPerfilOperadorProps {
    usuario: OperadorParaModificar;
}

export default function EditarPerfilOperador({ usuario }: EditarPerfilOperadorProps) {
    const [editando, setEditando] = useState(false);
    const [nombreFantasia, setNombreFantasia] = useState(usuario.nombreFantasia);
    const [whatsApp, setWhatsApp] = useState(usuario.whatsApp);
    const [foto, setFoto] = useState<string | null>(usuario.fotoPerfil);
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);
    const inputFotoRef =  useRef<HTMLInputElement>(null);
    const urlVistaPreviaRef =  useRef<string | null>(null);

    useEffect(() => {
        return () => {
            if (urlVistaPreviaRef.current) {
                URL.revokeObjectURL(urlVistaPreviaRef.current);
            }
        };
    }, []);

    function seleccionarFoto(evento: ChangeEvent<HTMLInputElement>) {
        if (!editando) return;

        const archivo = evento.target.files?.[0];

        if (!archivo) return;

        const formatosPermitidos = ["image/jpeg", "image/png", "image/webp"];

        if (!formatosPermitidos.includes(archivo.type) || archivo.size === 0 || archivo.size > 10 * 1024 * 1024) {
            setError("Seleccioná una imagen JPEG, PNG o WebP de hasta 10 MB.");
            evento.target.value = "";
            return;
        }

        if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);

        const url = URL.createObjectURL(archivo);

        urlVistaPreviaRef.current = url;

        setVistaPrevia(url);
        setError(null);
        setMensaje(null);

        evento.target.value = "";
    }

    function borrarFoto() {
        if (!editando) return;

        if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);

        urlVistaPreviaRef.current = null;

        setVistaPrevia(null);
        setFoto(null);
        setError(null);
        setMensaje(null);
    }

    function comenzarEdicion() {
        setError(null);
        setMensaje(null);
        setEditando(true);
    }

    function cancelarEdicion() {
        if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);

        urlVistaPreviaRef.current = null;

        setNombreFantasia(usuario.nombreFantasia);
        setWhatsApp(usuario.whatsApp);
        setFoto(usuario.fotoPerfil);
        setVistaPrevia(null);
        setError(null);
        setMensaje(null);
        setEditando(false);

        if (inputFotoRef.current) inputFotoRef.current.value = "";
    }

    function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        setError(null);
        setMensaje(null);

        const nombreFantasiaNormalizado = nombreFantasia.trim();
        const whatsAppNormalizado = whatsApp.trim();

        if (nombreFantasiaNormalizado === "") {
            setError("El nombre fantasía es obligatorio.");
            return;
        }

        if (whatsAppNormalizado === "") {
            setError("El número de WhatsApp es obligatorio.");
            return;
        }

        /*
        * TODO: implementar modificación en base de datos.
        *
        * Consulta/acción:
        * modificarPerfilOperador()
        *
        * Datos:
        * {
        *     operadorId: usuario.id,
        *     nombreFantasia: nombreFantasiaNormalizado,
        *     whatsApp: whatsAppNormalizado,
        *     foto: foto,
        *     fotoNueva: fotoNueva
        * }
        *
        * La unicidad de nombreFantasia debe ser
        * validada exclusivamente en backend/BD.
        */

        setNombreFantasia(nombreFantasiaNormalizado);
        setWhatsApp(whatsAppNormalizado);
        setEditando(false);

        setMensaje("Los cambios fueron validados");
    }

    const fotoVisible = vistaPrevia ?? foto;

    return (
        <section>
            <h3>Perfil del operador</h3>
            <form onSubmit={guardar}>
                <div>
                    <label htmlFor="nombre-fantasia-operador"> Nombre fantasía </label>
                    <input id="nombre-fantasia-operador" type="text" value={nombreFantasia} onChange={(evento) => 
                        setNombreFantasia(evento.target.value)} readOnly={!editando} disabled={!editando}/>
                </div>
                <div>
                    <label htmlFor="whatsapp-operador"> WhatsApp </label>
                    <input id="whatsapp-operador" type="text" value={whatsApp} onChange={(evento) => 
                        setWhatsApp(evento.target.value)} readOnly={!editando} disabled={!editando}/>
                </div>
                <div>
                    <span>Foto de perfil</span>
                    {fotoVisible ? (
                        <Image src={fotoVisible}  alt={`Foto de perfil de ${usuario.nombreFantasia}`} width={200} height={200}  unoptimized/>
                    ) : (
                        <p> Sin foto de perfil </p>
                    )}
                    {editando && (
                        <>
                            <button type="button" onClick={() => inputFotoRef.current?.click()}> Cambiar foto </button>
                            {fotoVisible && (<button type="button" onClick={borrarFoto}> Borrar foto </button>)}
                            <input ref={inputFotoRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={seleccionarFoto} hidden/>
                        </>
                    )}
                </div>

                {error && (<p role="alert"> {error} </p>)}

                {mensaje && (<p> {mensaje} </p>)}

                {editando ? (
                    <>
                        <button type="button" onClick={cancelarEdicion}> Cancelar </button>
                        <button type="submit"> Guardar </button>
                    </>
                ) : (
                    <button type="button" onClick={comenzarEdicion}> Editar </button>
                )}
            </form>
        </section>
    );
}