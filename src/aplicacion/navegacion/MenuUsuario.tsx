"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import Image from "next/image";
import Link from "next/link";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import { cerrarSesionYVolverAlInicio } from "../../modulos/identidad-acceso/autenticacion/acciones/cerrar-sesion";
import ContadorNotificaciones from "./ContadorNotificaciones";
import estilos from "./EncabezadoAplicacion.module.css";

type Propiedades = {
    abierto: boolean;
    cambiarAbierto: Dispatch<SetStateAction<boolean>>;
    fotoPerfil: string | null;
    inicialesPerfil: string;
    rutaPerfil: string;
    noLeidas: number;
    descripcionNotificacionesId: string;
    alFallarFoto: () => void;
    alNavegar: () => void;
    refrescarNotificaciones: () => void;
};

export default function MenuUsuario({
    abierto, cambiarAbierto, fotoPerfil, inicialesPerfil, rutaPerfil,
    noLeidas, descripcionNotificacionesId, alFallarFoto, alNavegar, refrescarNotificaciones,
}: Propiedades) {
    const referencia = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!abierto) return;

        function cerrarAlPulsarFuera(evento: PointerEvent) {
            if (evento.target instanceof Node && !referencia.current?.contains(evento.target)) {
                cambiarAbierto(false);
            }
        }

        document.addEventListener("pointerdown", cerrarAlPulsarFuera, true);
        return () => document.removeEventListener("pointerdown", cerrarAlPulsarFuera, true);
    }, [abierto, cambiarAbierto]);

    return (
        <div ref={referencia} className={estilos.menuOperador}>
            <button
                type="button"
                className={estilos.botonOperador}
                aria-label="Abrir menú de usuario"
                aria-describedby={noLeidas > 0 ? descripcionNotificacionesId : undefined}
                aria-expanded={abierto}
                onClick={() => {
                    if (!abierto) refrescarNotificaciones();
                    cambiarAbierto((valor) => !valor);
                }}
            >
                {fotoPerfil ? (
                    <Image
                        src={fotoPerfil}
                        alt="Foto de perfil"
                        unoptimized={fotoPerfil.startsWith("/api/")}
                        width={40}
                        height={40}
                        className={estilos.fotoPerfil}
                        onError={alFallarFoto}
                    />
                ) : inicialesPerfil ? (
                    <span className={estilos.inicialesPerfil} aria-hidden="true">{inicialesPerfil}</span>
                ) : (
                    <AccountCircleIcon className={estilos.iconoOperador} />
                )}
                {!abierto && <ContadorNotificaciones cantidad={noLeidas} enEsquina />}
            </button>
            {abierto && (
                <div className={estilos.desplegableOperador} role="menu">
                    <Link href="/notificaciones" role="menuitem" className={estilos.enlaceNotificaciones} onClick={alNavegar} aria-describedby={noLeidas > 0 ? descripcionNotificacionesId : undefined}>
                        <span className={estilos.etiquetaMenuMobile}><NotificationsNoneOutlinedIcon className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />Notificaciones</span>
                        <ContadorNotificaciones cantidad={noLeidas} />
                    </Link>
                    <Link href={rutaPerfil} className={estilos.opcionDesplegable} role="menuitem" onClick={alNavegar}>
                        <AccountCircleOutlinedIcon className={estilos.iconoMenuDesplegable} fontSize="small" aria-hidden="true" />
                        Mi perfil
                    </Link>
                    <form action={cerrarSesionYVolverAlInicio} onSubmit={alNavegar}>
                        <button type="submit" className={estilos.opcionDesplegable} role="menuitem">
                            <LogoutOutlinedIcon className={estilos.iconoMenuDesplegable} fontSize="small" aria-hidden="true" />
                            Cerrar sesión
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
