"use client";

import { useActionState, useState } from "react";
import { iniciarSesion, type EstadoInicioSesion } from "./acciones";

const estadoInicial: EstadoInicioSesion = {};

export default function FormularioInicioSesion() {
    const [estado, accion, pendiente] = useActionState(iniciarSesion, estadoInicial);
    const [identificador, cambiarIdentificador] = useState("");

    return (
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
                <input
                    id="contrasena"
                    name="contrasena"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
                />
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
        </form>
    );
}
