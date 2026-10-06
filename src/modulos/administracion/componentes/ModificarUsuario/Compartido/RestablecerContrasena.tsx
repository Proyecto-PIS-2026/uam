"use client";

import { useState } from "react";

interface RestablecerContrasenaProps {
    usuarioId: number;
}

export default function RestablecerContrasena({ usuarioId }: RestablecerContrasenaProps) {
    const [mostrarFormulario, setMostrarFormulario] = useState(false);

    const [nuevaContrasena, setNuevaContrasena] = useState("");

    const [confirmarContrasena, setConfirmarContrasena] = useState("");

    const [error, setError] = useState<string | null>(null);

    const [mensaje, setMensaje] = useState<string | null>(null);

    function abrirFormulario() {
        setMostrarFormulario(true);
        setNuevaContrasena("");
        setConfirmarContrasena("");
        setError(null);
        setMensaje(null);
    }

    function cancelar() {
        setMostrarFormulario(false);
        setNuevaContrasena("");
        setConfirmarContrasena("");
        setError(null);
        setMensaje(null);
    }

    function guardar(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        setError(null);
        setMensaje(null);

        if (nuevaContrasena === "") {
            setError("La nueva contraseña es obligatoria.");
            return;
        }

        if (confirmarContrasena === "") {
            setError("Debe confirmar la nueva contraseña.");
            return;
        }

        if (nuevaContrasena !== confirmarContrasena) {
            setError("Las contraseñas no coinciden.");
            return;
        }

        /*
         * TODO: implementar modificación en base de datos.
         *
         * Consulta/acción:
         * restablecerContrasena()
         *
         * Datos:
         * {
         *     usuarioId,
         *     nuevaPassword: nuevaContrasena
         * }
         *
         * La contraseña debe ser hasheada en backend.
         */

        void usuarioId;

        setNuevaContrasena("");
        setConfirmarContrasena("");
        setMostrarFormulario(false);

        setMensaje("La nueva contraseña fue validada.");
    }

    return (
        <section>
            <h3> Contraseña </h3>
            {!mostrarFormulario ? (
                <>
                    <button type="button" onClick={abrirFormulario}> Restablecer contraseña </button>
                    {mensaje && (<p> {mensaje} </p>)}
                </>
            ) : (
                <form onSubmit={guardar}>
                    <div>
                        <label htmlFor="nueva-contrasena"> Nueva contraseña </label>
                        <input id="nueva-contrasena" type="password" value={nuevaContrasena} onChange={(evento) =>
                            setNuevaContrasena(evento.target.value)} required/>
                    </div>
                    <div>
                        <label htmlFor="confirmar-contrasena"> Confirmar contraseña </label>
                        <input id="confirmar-contrasena" type="password" value={ confirmarContrasena } onChange={(evento) =>
                            setConfirmarContrasena(evento.target.value)} required/>
                    </div>
                    {error && (<p role="alert"> {error} </p>)}

                    <button type="button" onClick={cancelar}> Cancelar </button>
                    <button type="submit"> Restablecer contraseña </button>
                </form>
            )}
        </section>
    );
}