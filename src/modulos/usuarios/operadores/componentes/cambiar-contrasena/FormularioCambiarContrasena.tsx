"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import Link from "next/link";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
    cambiarContrasena,
    type EstadoCambioContrasena,
} from "../../acciones/cambiarContrasena";

const estadoInicial: EstadoCambioContrasena = {};

type CampoContrasenaProps = {
    id: string;
    name: string;
    label: string;
    autoComplete: string;
};

function CampoContrasena({
    id,
    name,
    label,
    autoComplete,
}: CampoContrasenaProps) {
    const [visible, cambiarVisibilidad] = useState(false);

    return (
        <div>
            <label htmlFor={id} className="mb-2 block text-sm font-medium">
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    name={name}
                    type={visible ? "text" : "password"}
                    required
                    autoComplete={autoComplete}
                    className="campo-formulario campo-formulario-con-icono"
                />
                <button
                    type="button"
                    aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
                    onClick={() => cambiarVisibilidad((actual) => !actual)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-foreground"
                >
                    {visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                </button>
            </div>
        </div>
    );
}

export default function FormularioCambiarContrasena() {
    const { notificar, cerrarNotificacion } = useNotificacionToast();
    const estadoNotificado = useRef<EstadoCambioContrasena | null>(null);
    const [estado, accion, pendiente] = useActionState(
        cambiarContrasena,
        estadoInicial,
    );
    useEffect(() => {
        if (estadoNotificado.current === estado) return;
        estadoNotificado.current = estado;
        if (estado.error || estado.exito) cerrarNotificacion();
        if (estado.error) notificar(estado.error, "error");
        else if (estado.exito) notificar(estado.exito, "success");
    }, [estado, notificar, cerrarNotificacion]);

    return (
        <form
            action={accion}
            className="w-full max-w-md secciones-pagina rounded-[var(--radio-panel)] border border-border bg-surface p-[var(--padding-panel)] shadow-[var(--sombra-panel)]"
        >
            <CampoContrasena
                id="contrasenaActual"
                name="contrasenaActual"
                label="Contraseña actual"
                autoComplete="current-password"
            />
            <CampoContrasena
                id="nuevaContrasena"
                name="nuevaContrasena"
                label="Nueva contraseña"
                autoComplete="new-password"
            />
            <CampoContrasena
                id="confirmacionContrasena"
                name="confirmacionContrasena"
                label="Repetir nueva contraseña"
                autoComplete="new-password"
            />
            <button type="submit" disabled={pendiente} className="boton-primario w-full">
                {pendiente ? "Cambiando..." : "Cambiar contraseña"}
            </button>
            <Link href="/mi-perfil" className="boton-secundario w-full">
                Cancelar
            </Link>
        </form>
    );
}
