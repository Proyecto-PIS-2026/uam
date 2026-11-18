"use client";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import { useContadorNotificaciones } from "@/modulos/notificaciones/hooks/useContadorNotificaciones";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { cerrarSesionYVolverAlInicio } from "@/modulos/identidad-acceso/autenticacion/acciones/cerrar-sesion";
import { obtenerRutaPrincipal } from "@/modulos/identidad-acceso/autorizacion/rutas";
import { obtenerIniciales } from "@/modulos/usuarios/obtener-iniciales";
import ContadorNotificaciones from "./ContadorNotificaciones";
import MenuUsuario from "./MenuUsuario";
import OpcionesNavegacion from "./OpcionesNavegacion";
import { esRutaNavegacionActiva, obtenerOpcionesNavegacion } from "./opciones-navegacion";
import estilos from "./EncabezadoAplicacion.module.css";

type PropiedadesEncabezado = {
    sesion: DatosSesion | null;
    fotoPerfil?: string | null;
    nombrePerfil?: string | null;
};

export default function EncabezadoAplicacion({ sesion, fotoPerfil = null, nombrePerfil = null }: PropiedadesEncabezado) {
    const rolUsuario = sesion?.rol ?? null;
    const esProductor = rolUsuario === "PRODUCTOR";
    const esAdministrador = rolUsuario === "ADMINISTRADOR";
    const inicialesPerfil = rolUsuario === "OPERADOR" || esProductor ? obtenerIniciales(nombrePerfil ?? "") : "";
    const [menuAbierto, cambiarMenuAbierto] = useState(false);
    const [menuUsuarioAbierto, cambiarMenuUsuarioAbierto] = useState(false);
    const [fotoPerfilFallida, cambiarFotoPerfilFallida] = useState(false);
    const rutaActual = usePathname() ?? "";
    const { noLeidas, refrescar: refrescarNotificaciones } = useContadorNotificaciones(sesion?.usuarioId ?? null);
    const descripcionNotificacionesId = useId();
    const rutaPrincipal = obtenerRutaPrincipal(rolUsuario);
    const opcionesNavegacion = obtenerOpcionesNavegacion(sesion);

    function cerrarMenus() {
        cambiarMenuAbierto(false);
        cambiarMenuUsuarioAbierto(false);
    }

    const menuPerfilMobile = rolUsuario && (
        <Link href={esProductor ? "/mi-perfil/productor" : "/mi-perfil"} className={`${estilos.enlaceMobile} ${estilos.perfilMobile}`} onClick={cerrarMenus}>
            <span className={estilos.etiquetaMenuMobile}>
                <AccountCircleOutlinedIcon className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />
                Mi perfil
            </span>
            {fotoPerfil && !fotoPerfilFallida ? (
                <Image
                    src={fotoPerfil}
                    alt=""
                    unoptimized={fotoPerfil.startsWith("/api/")}
                    width={32}
                    height={32}
                    className={estilos.fotoPerfilMobile}
                    onError={() => cambiarFotoPerfilFallida(true)}
                />
            ) : inicialesPerfil ? (
                <span className={`${estilos.inicialesPerfil} ${estilos.inicialesPerfilMobile}`} aria-hidden="true">{inicialesPerfil}</span>
            ) : null}
        </Link>
    );

    const menuCerrarSesionMobile = rolUsuario && (
        <form action={cerrarSesionYVolverAlInicio} onSubmit={cerrarMenus}>
            <button type="submit" className={`${estilos.enlaceMobile} ${estilos.cerrarSesionMobile}`}>
                <LogoutOutlinedIcon className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />
                Cerrar sesión
            </button>
        </form>
    );

    const contenido = (
        <>
            <header className={estilos.header}>
                <div className={estilos.contenido}>
                    <Link
                        href={rutaPrincipal}
                        className={estilos.marca}
                        aria-label={rolUsuario === "OPERADOR" || esProductor ? "Ir a Mi mercado" : "Ir al inicio"}
                        onClick={() => cambiarMenuAbierto(false)}
                    >
                        <Image
                            src="/Logo.PNG"
                            alt="Unidad Agroalimentaria Metropolitana"
                            width={410}
                            height={94}
                            priority
                            className={estilos.logo}
                        />
                    </Link>
                    <nav className={estilos.navegacion} aria-label="Navegación principal">
                        <OpcionesNavegacion
                            opciones={opcionesNavegacion}
                            esAdministrador={esAdministrador}
                            rutaActual={rutaActual}
                            alNavegar={() => cambiarMenuAbierto(false)}
                        />
                    </nav>
                    {rolUsuario && <MenuUsuario
                        abierto={menuUsuarioAbierto}
                        cambiarAbierto={cambiarMenuUsuarioAbierto}
                        fotoPerfil={fotoPerfilFallida ? null : fotoPerfil}
                        inicialesPerfil={inicialesPerfil}
                        rutaPerfil={esProductor ? "/mi-perfil/productor" : "/mi-perfil"}
                        noLeidas={noLeidas}
                        descripcionNotificacionesId={descripcionNotificacionesId}
                        alFallarFoto={() => cambiarFotoPerfilFallida(true)}
                        alNavegar={cerrarMenus}
                        refrescarNotificaciones={refrescarNotificaciones}
                    />}
                    <button
                        className={estilos.menuMobile}
                        type="button"
                        onClick={() => { if (!menuAbierto) refrescarNotificaciones(); cambiarMenuAbierto((abierto) => !abierto) }}
                        aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
                        aria-describedby={noLeidas > 0 ? descripcionNotificacionesId : undefined}
                        aria-expanded={menuAbierto}
                        aria-controls="menu-mobile"
                    >
                        <MenuIcon
                            className={`${estilos.iconoMenu} ${menuAbierto ? estilos.iconoMenuOculto : estilos.iconoMenuVisible}`}
                        />
                        <CloseIcon
                            className={`${estilos.iconoMenu} ${menuAbierto ? estilos.iconoCerrarVisible : estilos.iconoCerrarOculto}`}
                        />
                        {!menuAbierto && <ContadorNotificaciones cantidad={noLeidas} enEsquina />}
                    </button>
                    {rolUsuario && <span id={descripcionNotificacionesId} className={estilos.descripcionNotificaciones}>{noLeidas} {noLeidas === 1 ? "notificación sin leer" : "notificaciones sin leer"}</span>}
                </div>
                <nav
                    id="menu-mobile"
                    className={`${estilos.navegacionMobile} ${menuAbierto ? estilos.navegacionMobileAbierta : ""}`}
                    aria-label="Navegación móvil"
                >
                    {!esAdministrador && menuPerfilMobile}
                    {!esAdministrador && rolUsuario && <Link href="/notificaciones" className={`${estilos.enlaceMobile} ${estilos.enlaceNotificaciones}`} aria-current={esRutaNavegacionActiva(rutaActual, "/notificaciones") ? "page" : undefined} aria-describedby={noLeidas > 0 ? descripcionNotificacionesId : undefined} onClick={cerrarMenus}>
                        <span className={estilos.etiquetaMenuMobile}><NotificationsNoneOutlinedIcon className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />Notificaciones</span>
                        <ContadorNotificaciones cantidad={noLeidas} />
                    </Link>}
                    <OpcionesNavegacion
                        opciones={opcionesNavegacion}
                        esAdministrador={esAdministrador}
                        rutaActual={rutaActual}
                        mobile
                        alNavegar={() => cambiarMenuAbierto(false)}
                    />
                    {esAdministrador && rolUsuario && <Link href="/notificaciones" className={`${estilos.enlaceMobile} ${estilos.enlaceNotificaciones}`} aria-current={esRutaNavegacionActiva(rutaActual, "/notificaciones") ? "page" : undefined} aria-describedby={noLeidas > 0 ? descripcionNotificacionesId : undefined} onClick={cerrarMenus}>
                        <span className={estilos.etiquetaMenuMobile}><NotificationsNoneOutlinedIcon className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />Notificaciones</span>
                        <ContadorNotificaciones cantidad={noLeidas} />
                    </Link>}
                    {esAdministrador && menuPerfilMobile}
                    {menuCerrarSesionMobile}
                </nav>
            </header>
            {menuAbierto && (
                <div
                    className={estilos.overlayMenu}
                    onMouseDown={() => cambiarMenuAbierto(false)}
                    aria-hidden="true"
                />
            )}
        </>
    );
    return contenido;
}
