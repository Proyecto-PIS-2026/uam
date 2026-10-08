"use client";

import { useState } from "react";
import type { ProductorParaModificar } from "../../Tipos";
import RestablecerContrasena from "../RestablecerContrasena";

interface ModificarProductorProps {
    usuario: ProductorParaModificar;
}

export default function ModificarProductor({ usuario }: ModificarProductorProps) {
    const [editando, setEditando] = useState(false);
    const [whatsApp, setWhatsApp] = useState(usuario.whatsApp);
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);

    function comenzarEdicion() {
        setError(null);
        setMensaje(null);
        setEditando(true);
    }

    function cancelarEdicion() {
        setWhatsApp(usuario.whatsApp);
        setError(null);
        setMensaje(null);
        setEditando(false);
    }

    function guardar(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setError(null);
        setMensaje(null);

        const whatsAppNormalizado = whatsApp.trim();

        if (whatsAppNormalizado === "") {
            setError("El número de WhatsApp es obligatorio.");
            return;
        }

        /*
         * TODO: implementar modificación en BD.
         *
         * Consulta/acción:
         * modificarWhatsAppProductor()
         *
         * Datos:
         * {
         *     productorId: usuario.id,
         *     whatsApp: whatsAppNormalizado
         * }
         */

        setWhatsApp(whatsAppNormalizado);
        setEditando(false);
        setMensaje("Los cambios fueron validados.");
    }

    return (
        <div>
            <section>
                <h3>Perfil del productor</h3>
                <form onSubmit={guardar}>
                    <div>
                        <label htmlFor="whatsapp-productor">WhatsApp</label>
                        <input id="whatsapp-productor" type="text" value={whatsApp} onChange={(evento) => setWhatsApp(evento.target.value)} readOnly={!editando} disabled={!editando} />
                    </div>

                    {error && <p role="alert">{error}</p>}
                    {mensaje && <p>{mensaje}</p>}

                    {editando ? (
                        <>
                            <button type="button" onClick={cancelarEdicion}>Cancelar</button>
                            <button type="submit">Guardar</button>
                        </>
                    ) : (
                        <button type="button" onClick={comenzarEdicion}>Editar</button>
                    )}
                </form>
            </section>

            <RestablecerContrasena usuarioId={usuario.id} />
        </div>
    );
}