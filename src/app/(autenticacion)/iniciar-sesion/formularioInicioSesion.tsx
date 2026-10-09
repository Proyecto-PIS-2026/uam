"use client";

import { useActionState, useState } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
    iniciarSesion,
    solicitarRecuperacion,
    type EstadoInicioSesion,
} from "./acciones";

const estadoInicial: EstadoInicioSesion = {};

export default function FormularioInicioSesion() {
    const [estado, accion, pendiente] = useActionState(iniciarSesion, estadoInicial);
    const [identificador, cambiarIdentificador] = useState("");
    const [mostrarContrasena, cambiarMostrarContrasena] = useState(false);
    const [modalRecuperacionAbierto, cambiarModalRecuperacionAbierto] = useState(false);
    const [usuarioRecuperacion, cambiarUsuarioRecuperacion] = useState("");
    const [errorRecuperacion, cambiarErrorRecuperacion] = useState("");
    const [mensajeRecuperacion, cambiarMensajeRecuperacion] = useState("");
    const [solicitudPendiente, cambiarSolicitudPendiente] = useState(false);

    function abrirModalRecuperacion() {
        cambiarErrorRecuperacion("");
        cambiarMensajeRecuperacion("");
        cambiarModalRecuperacionAbierto(true);
    }

    function cerrarModalRecuperacion() {
        cambiarErrorRecuperacion("");
        cambiarMensajeRecuperacion("");
        cambiarModalRecuperacionAbierto(false);
    }

    async function aceptarSolicitudRecuperacion() {
        if (!usuarioRecuperacion.trim()) {
            cambiarErrorRecuperacion("Ingresá tu nombre de usuario para solicitar la recuperación.");
            return;
        }

        cambiarSolicitudPendiente(true);
        const resultado = await solicitarRecuperacion(usuarioRecuperacion);
        cambiarSolicitudPendiente(false);
        cambiarErrorRecuperacion(resultado.error ?? "");
        cambiarMensajeRecuperacion(resultado.exito ?? "");
    }

    return (
        <>
            <form
                action={accion}
                className="w-full max-w-md space-y-5 rounded-lg bg-[var(--color-surface)] p-6 shadow-sm"
            >
                <div>
                    <label htmlFor="identificador" className="mb-2 block text-sm font-medium">
                        Correo electrónico o nombre de usuario
                    </label>
                    <input
                        id="identificador"
                        name="identificador"
                        type="text"
                        required
                        autoComplete="username"
                        value={identificador}
                        onChange={(evento) => cambiarIdentificador(evento.target.value)}
                        className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
                    />
                </div>
                <div>
                    <label htmlFor="contrasena" className="mb-2 block text-sm font-medium">
                        Contraseña
                    </label>
                    <div className="relative">
                        <input
                            id="contrasena"
                            name="contrasena"
                            type={mostrarContrasena ? "text" : "password"}
                            required
                            autoComplete="current-password"
                            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 pr-11"
                        />
                        <button
                            type="button"
                            aria-label={mostrarContrasena ? "Ocultar contraseña" : "Mostrar contraseña"}
                            onClick={() => cambiarMostrarContrasena((mostrar) => !mostrar)}
                            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-black"
                        >
                            {mostrarContrasena ? <VisibilityIcon /> : <VisibilityOffIcon />}
                        </button>
                    </div>
                </div>
                {estado.error && (
                    <p role="alert" className="text-sm text-red-700">
                        {estado.error}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={pendiente}
                    className="w-full rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {pendiente ? "Ingresando..." : "Iniciar sesión"}
                </button>
                <button
                    type="button"
                    onClick={abrirModalRecuperacion}
                    className="w-full text-center text-sm text-[var(--color-primary)] underline underline-offset-2 hover:opacity-80"
                >
                    Solicitar recuperación de contraseña
                </button>
            </form>
            {modalRecuperacionAbierto && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
                    role="presentation"
                    onMouseDown={(evento) => {
                        if (evento.target === evento.currentTarget) cerrarModalRecuperacion();
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="titulo-recuperacion-contrasena"
                        className="w-full max-w-md rounded-lg bg-[var(--color-surface)] p-6 shadow-xl"
                    >
                        <h2 id="titulo-recuperacion-contrasena" className="mb-3 text-xl font-semibold">
                            Solicitar recuperación de contraseña
                        </h2>
                        <p className="mb-4 text-sm text-[var(--color-foreground)]">
                            Ingresá tu nombre de usuario y confirmá si estás seguro de solicitar la recuperación.
                        </p>
                        <label htmlFor="usuarioRecuperacion" className="mb-2 block text-sm font-medium">
                            Nombre de usuario
                        </label>
                        <input
                            id="usuarioRecuperacion"
                            type="text"
                            autoComplete="username"
                            value={usuarioRecuperacion}
                            onChange={(evento) => {
                                cambiarUsuarioRecuperacion(evento.target.value);
                                if (errorRecuperacion) cambiarErrorRecuperacion("");
                            }}
                            className="mb-2 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
                        />
                        {errorRecuperacion && (
                            <p role="alert" className="mb-4 text-sm text-red-700">
                                {errorRecuperacion}
                            </p>
                        )}
                        {mensajeRecuperacion && (
                            <p role="status" className="mb-4 text-sm text-[var(--color-primary)]">
                                {mensajeRecuperacion}
                            </p>
                        )}
                        <div className="mx-auto flex w-full max-w-[15rem] items-center justify-between">
                            <button
                                type="button"
                                onClick={cerrarModalRecuperacion}
                                className="rounded-md border border-[var(--color-border)] px-4 py-2 font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={aceptarSolicitudRecuperacion}
                                disabled={solicitudPendiente}
                                className="rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-white"
                            >
                                {solicitudPendiente ? "Enviando..." : "Aceptar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
