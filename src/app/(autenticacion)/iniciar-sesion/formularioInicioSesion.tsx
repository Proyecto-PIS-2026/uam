"use client";

import { useActionState, useState } from "react";
import { iniciarSesion, type EstadoInicioSesion } from "./acciones";

const estadoInicial: EstadoInicioSesion = {};

export default function FormularioInicioSesion() {
    const [estado, accion, pendiente] = useActionState(iniciarSesion, estadoInicial);
    const [rol, setRol] = useState<"OPERADOR" | "ADMINISTRADOR">("OPERADOR");
    const esAdministrador = rol === "ADMINISTRADOR";

    return (
        <form action={accion} className="w-full max-w-md space-y-5 rounded-lg bg-[var(--color-surface)] p-6 shadow-sm">
            <div>
                <label htmlFor="rol" className="mb-2 block text-sm font-medium">Ingresar como</label>
                <select id="rol" name="rol" value={rol} onChange={(evento) => setRol(evento.target.value as "OPERADOR" | "ADMINISTRADOR")} className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2">
                    <option value="OPERADOR">Operador</option>
                    <option value="ADMINISTRADOR">Administrador</option>
                </select>
            </div>
            <div>
                <label htmlFor="identificador" className="mb-2 block text-sm font-medium">{esAdministrador ? "Correo electrónico" : "Nombre de usuario"}</label>
                <input id="identificador" name="identificador" type={esAdministrador ? "email" : "text"} required autoComplete={esAdministrador ? "email" : "username"} className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2" />
            </div>
            <div>
                <label htmlFor="contrasena" className="mb-2 block text-sm font-medium">Contraseña</label>
                <input id="contrasena" name="contrasena" type="password" required autoComplete="current-password" className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2" />
            </div>
            {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
            <button type="submit" disabled={pendiente} className="w-full rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">
                {pendiente ? "Ingresando..." : "Iniciar sesión"}
            </button>
        </form>
    );
}