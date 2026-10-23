"use client";

import { useActionState, useState } from "react";
import NotificacionToast, { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
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
    const { notificacion, notificar, cerrarNotificacion } = useNotificacionToast();
    const [solicitudPendiente, cambiarSolicitudPendiente] = useState(false);

    function abrirModalRecuperacion() {
        cambiarErrorRecuperacion("");
        cerrarNotificacion();
        cambiarModalRecuperacionAbierto(true);
    }

    function cerrarModalRecuperacion() {
        cambiarErrorRecuperacion("");
        cambiarModalRecuperacionAbierto(false);
    }

    async function aceptarSolicitudRecuperacion() {
        if (solicitudPendiente) return;
        if (!usuarioRecuperacion.trim()) {
            cambiarErrorRecuperacion("Ingresá tu nombre de usuario para solicitar la recuperación.");
            return;
        }

        cambiarSolicitudPendiente(true);
        cambiarErrorRecuperacion("");
        cerrarNotificacion();
        try {
            const resultado = await solicitarRecuperacion(usuarioRecuperacion);
            if (resultado.tipoError === "operacion" && resultado.error) {
                notificar(resultado.error, "error");
            } else {
                cambiarErrorRecuperacion(resultado.error ?? "");
            }
            if (resultado.exito) notificar(resultado.exito, "success");
        } catch {
            notificar("No se pudo registrar la solicitud. Intentá nuevamente.", "error");
        } finally {
            cambiarSolicitudPendiente(false);
        }
    }

    return (
        <>
            <form
                action={accion}
                className="w-full max-w-md secciones-pagina rounded-[var(--radio-panel)] border border-border bg-surface p-[var(--padding-panel)] shadow-[var(--sombra-panel)]"
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
                        className="campo-formulario"
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
                            className="campo-formulario campo-formulario-con-icono"
                        />
                        <button
                            type="button"
                            aria-label={mostrarContrasena ? "Ocultar contraseña" : "Mostrar contraseña"}
                            onClick={() => cambiarMostrarContrasena((mostrar) => !mostrar)}
                            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-foreground"
                        >
                            {mostrarContrasena ? <VisibilityIcon /> : <VisibilityOffIcon />}
                        </button>
                    </div>
                </div>
                {estado.error && (
                    <p role="alert" className="text-sm text-danger">
                        {estado.error}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={pendiente}
                    className="boton-primario w-full"
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
                        className="w-full max-w-md rounded-[var(--radio-panel)] bg-surface p-[var(--padding-panel)] shadow-xl"
                    >
                        <h2 id="titulo-recuperacion-contrasena" className="titulo-seccion mb-[var(--espacio-controles)]">
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
                            className="mb-2 campo-formulario"
                        />
                        {errorRecuperacion && (
                            <p role="alert" className="mb-4 text-sm text-danger">
                                {errorRecuperacion}
                            </p>
                        )}
                        <div className="flex w-full items-center justify-end gap-[var(--espacio-controles)]">
                            <button
                                type="button"
                                onClick={cerrarModalRecuperacion}
                                className="boton-secundario"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={aceptarSolicitudRecuperacion}
                                disabled={solicitudPendiente}
                                className="boton-primario"
                            >
                                {solicitudPendiente ? "Enviando..." : "Aceptar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} />
        </>
    );
}
