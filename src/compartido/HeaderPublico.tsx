"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Badge from "@mui/material/Badge";

import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import AgricultureOutlinedIcon from "@mui/icons-material/AgricultureOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NaturePeopleOutlinedIcon from "@mui/icons-material/NaturePeopleOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import { useContadorNotificaciones } from "@/modulos/notificaciones/use-contador-notificaciones";
import { usePathname } from "next/navigation";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { cerrarSesionYVolverAlInicio } from "@/modulos/identidad-acceso/autenticacion/accionCerrarSesion";
import { obtenerRutaPrincipal } from "@/modulos/identidad-acceso/autorizacion/rutas";

import { useId } from "react";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import estilos from "./HeaderPublico.module.css";

function ContadorNotificaciones({ cantidad, enEsquina = false }: { cantidad: number; enEsquina?: boolean }) {
    if (cantidad <= 0) return null;

    return (
        <Badge
            badgeContent={cantidad}
            max={99}
            color="error"
            sx={enEsquina ? {
                position: "absolute",
                right: "-0.15rem",
                bottom: "-0.15rem",
                zIndex: 1,
                pointerEvents: "none",
            } : undefined}
            slotProps={{
                badge: {
                    "aria-hidden": true,
                    sx: {
                        position: "static",
                        transform: "none",
                        backgroundColor: "var(--color-danger)",
                        color: "var(--color-surface)",
                        ...(enEsquina && { outline: "2px solid var(--color-surface)" }),
                    },
                },
            }}
        />
    );
}

type OpcionMenu = {
    nombre: string;
    ruta: string;
    icono: typeof StorefrontOutlinedIcon;
    permitido?: (sesion: DatosSesion | null) => boolean;
    soloSinSesion?: boolean;
    ocultarParaOperador?: boolean;
};

const opcionesMenu: OpcionMenu[] = [
    {
        nombre: "Inicio",
        ruta: "/inicio",
        icono: HomeOutlinedIcon,
        ocultarParaOperador: true,
    },
    
    {
        nombre: "Mercado Virtual",
        ruta: "/publicaciones",
        icono: StorefrontOutlinedIcon,
        permitido: () => autorizado("operador.publicacion.consultar"),
        ocultarParaOperador: true,
    },
    // Listado de publicaciones de productores
    {
        nombre: "Mercado Producción",
        ruta: "/publicaciones-productor",
        icono: AgricultureOutlinedIcon,
        permitido: (sesion) => autorizado("productor.publicacion.consultar", sesion),
    },

    {
        nombre: "Operadores",
        ruta: "/operadores",
        icono: GroupsOutlinedIcon,
        permitido: () => autorizado("operador.catalogo.consultar"),
        ocultarParaOperador: true,
    },

    {
        nombre: "Productores",
        ruta: "/productores",
        icono: NaturePeopleOutlinedIcon,
        permitido: (sesion) => autorizado("productor.publicacion.consultar", sesion),
    },

    {
        nombre: "Precios de referencia",
        ruta: "/precios-referencia",
        icono: PaymentsOutlinedIcon,
        permitido: () => autorizado("preciosReferencia.consultar"),
    },

    {
        nombre: "Mi mercado",
        ruta: "/mi-mercado",
        icono: Inventory2OutlinedIcon,
        permitido: (sesion) => autorizado("operador.mercado.acceder", sesion),
    },

    {
        nombre: "Iniciar sesión",
        ruta: "/iniciar-sesion",
        icono: LoginOutlinedIcon,
        soloSinSesion: true,
    },

    { 
        nombre: "Administración", 
        ruta: "/administracion",
        icono: AdminPanelSettingsOutlinedIcon,
        permitido: (sesion) => autorizado("usuarios.cuentas.gestionar", sesion),
    }
];

const opcionesMenuProductor: OpcionMenu[] = [
    {
        nombre: "Mi mercado",
        ruta: "/mi-mercado/productor",
        icono: Inventory2OutlinedIcon,
        permitido: (sesion) => autorizado("productor.mercado.acceder", sesion),
    },
    {
        nombre: "Precios de referencia",
        ruta: "/precios-referencia",
        icono: PaymentsOutlinedIcon,
        permitido: () => autorizado("preciosReferencia.consultar"),
    },
    {
        nombre: "Histórico de precios",
        ruta: "/precios-historicos",
        icono: ShowChartOutlinedIcon,
        permitido: () => autorizado("preciosReferencia.consultar"),
    },
];

type PropiedadesEncabezado = {
    sesion: DatosSesion | null;
    fotoPerfil?: string | null;
};

function MenuPublicaciones({
    mobile = false,
    rutaActual,
    onNavigate,
}: {
    mobile?: boolean;
    rutaActual: string;
    onNavigate: () => void;
}) {
    const [abierto, setAbierto] = useState(false);
    const referencia = useRef<HTMLDivElement>(null);
    const botonRef = useRef<HTMLButtonElement>(null);
    const id = useId();

    const opciones = [
        { nombre: "Mercado Virtual", ruta: "/publicaciones", icono: StorefrontOutlinedIcon },
        { nombre: "Mercado Producción", ruta: "/publicaciones-productor", icono: AgricultureOutlinedIcon },
    ];

    const esActiva = (ruta: string) =>
        rutaActual === ruta || rutaActual.startsWith(`${ruta}/`);

    const activo = opciones.some((opcion) => esActiva(opcion.ruta));

    useEffect(() => {
        if (!abierto) return;

        function cerrarAlPulsarFuera(evento: PointerEvent) {
            if (
                evento.target instanceof Node &&
                !referencia.current?.contains(evento.target)
            ) {
                setAbierto(false);
            }
        }

        document.addEventListener("pointerdown", cerrarAlPulsarFuera);

        return () => {
            document.removeEventListener("pointerdown", cerrarAlPulsarFuera);
        };
    }, [abierto]);

    return (
        <div
            ref={referencia}
            className={estilos.grupoPublicaciones}
            onBlur={(evento) => {
                if (!evento.currentTarget.contains(evento.relatedTarget)) {
                    setAbierto(false);
                }
            }}
            onKeyDown={(evento) => {
                if (evento.key === "Escape" && abierto) {
                    evento.preventDefault();
                    evento.stopPropagation();
                    setAbierto(false);
                    botonRef.current?.focus();
                }
            }}
        >
            <button
                ref={botonRef}
                type="button"
                className={[
                    mobile ? estilos.enlaceMobile : estilos.enlace,
                    estilos.botonPublicaciones,
                    activo ? estilos.enlaceActivo : "",
                ].join(" ")}
                aria-expanded={abierto}
                aria-controls={id}
                onClick={() => setAbierto((valor) => !valor)}
            >
                {mobile ? (
                    <span className={estilos.etiquetaMenuMobile}>
                        <StorefrontOutlinedIcon className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />
                        Mercados
                    </span>
                ) : "Mercados"}
                {abierto ? (
                    <KeyboardArrowUpIcon
                        className={estilos.iconoExpandir}
                        aria-hidden="true"
                    />
                ) : (
                    <KeyboardArrowDownIcon
                        className={estilos.iconoExpandir}
                        aria-hidden="true"
                    />
                )}
            </button>

            <div
                id={id}
                inert={!abierto}
                className={[
                    estilos.listaPublicaciones,
                    abierto ? estilos.listaPublicacionesAbierta : "",
                    mobile ? estilos.listaPublicacionesMobile : "",
                ].join(" ")}
            >
                {opciones.map((opcion) => (
                    <Link
                        key={opcion.ruta}
                        href={opcion.ruta}
                        aria-current={esActiva(opcion.ruta) ? "page" : undefined}
                        className={[
                            estilos.opcionPublicaciones,
                            esActiva(opcion.ruta)
                                ? estilos.opcionPublicacionesActiva
                                : "",
                        ].join(" ")}
                        onClick={() => {
                            setAbierto(false);
                            onNavigate();
                        }}
                    >
                        {mobile && <opcion.icono className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />}
                        {opcion.nombre}
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default function HeaderPublico({ sesion, fotoPerfil = null }: PropiedadesEncabezado) {
    const rolUsuario = sesion?.rol ?? null;
    const esProductor = rolUsuario === "PRODUCTOR";
    const [menuAbierto, cambiarMenuAbierto] = useState(false);
    const [menuUsuarioAbierto, cambiarMenuUsuarioAbierto] = useState(false);
    const [fotoPerfilFallida, cambiarFotoPerfilFallida] = useState(false);
    const referenciaMenuUsuario = useRef<HTMLDivElement>(null);
    const rutaActual = usePathname() ?? "";
    const { noLeidas, refrescar: refrescarNotificaciones } = useContadorNotificaciones(sesion?.usuarioId ?? null);
    const descripcionNotificacionesId = useId();
    const rutaPrincipal = obtenerRutaPrincipal(rolUsuario);
    const opcionesVisibles = (esProductor ? opcionesMenuProductor : opcionesMenu).filter(
        (opcion) =>
            (!opcion.permitido || opcion.permitido(sesion)) &&
            (!opcion.soloSinSesion || rolUsuario === null) &&
            (!opcion.ocultarParaOperador || rolUsuario !== "OPERADOR"),
    );

    const esAdministrador = rolUsuario === "ADMINISTRADOR";
    const opcionesNavegacion = opcionesVisibles.filter((opcion) => !esAdministrador || opcion.ruta !== "/publicaciones-productor");

    useEffect(() => {
        if (!menuUsuarioAbierto) return;

        function cerrarMenuAlPulsarFuera(evento: PointerEvent) {
            const elementoPulsado = evento.target;
            if (
                elementoPulsado instanceof Node &&
                !referenciaMenuUsuario.current?.contains(elementoPulsado)
            ) {
                cambiarMenuUsuarioAbierto(false);
            }
        }

        document.addEventListener("pointerdown", cerrarMenuAlPulsarFuera, true);
        return () => {
            document.removeEventListener("pointerdown", cerrarMenuAlPulsarFuera, true);
        };
    }, [menuUsuarioAbierto]);

    function esRutaActiva(ruta: string) {
        if (ruta === "/mi-mercado") {
            return (
                rutaActual === ruta ||
                rutaActual.startsWith(`${ruta}/`) ||
                rutaActual.startsWith("/publicaciones/nueva")
            );
        }
        if (ruta === "/publicaciones" && rutaActual.startsWith("/publicaciones/nueva")) {
            return false;
        }
        return rutaActual === ruta || rutaActual.startsWith(`${ruta}/`);
    }

    function cerrarMenus() {
        cambiarMenuAbierto(false);
        cambiarMenuUsuarioAbierto(false);
    }

    const menuUsuario = rolUsuario && (
        <div ref={referenciaMenuUsuario} className={estilos.menuOperador}>
            <button
                type="button"
                className={estilos.botonOperador}
                aria-label="Abrir menú de usuario"
                aria-describedby={noLeidas > 0 ? descripcionNotificacionesId : undefined}
                aria-expanded={menuUsuarioAbierto}
                onClick={() => { if (!menuUsuarioAbierto) refrescarNotificaciones(); cambiarMenuUsuarioAbierto((abierto) => !abierto) }}
            >
                {fotoPerfil && !fotoPerfilFallida ? (
                    <Image
                        src={fotoPerfil}
                        alt="Foto de perfil"
                        unoptimized={fotoPerfil.startsWith("/api/")}
                        width={40}
                        height={40}
                        className={estilos.fotoPerfil}
                        onError={() => cambiarFotoPerfilFallida(true)}
                    />
                ) : (
                    <AccountCircleIcon className={estilos.iconoOperador} />
                )}
                <ContadorNotificaciones cantidad={noLeidas} enEsquina />
            </button>
            {menuUsuarioAbierto && (
                <div className={estilos.desplegableOperador} role="menu">
                    <Link href="/notificaciones" role="menuitem" className={estilos.enlaceNotificaciones} onClick={cerrarMenus} aria-describedby={noLeidas > 0 ? descripcionNotificacionesId : undefined}>
                        <span className={estilos.etiquetaMenuMobile}><NotificationsNoneOutlinedIcon className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />Notificaciones</span>
                        <ContadorNotificaciones cantidad={noLeidas} />
                    </Link>
                    {esProductor ? (
                        <Link href="/mi-perfil/productor" className={estilos.opcionDesplegable} role="menuitem" onClick={cerrarMenus}>Mi perfil</Link>
                    ) : (
                        <Link href="/mi-perfil" className={estilos.opcionDesplegable} role="menuitem" onClick={cerrarMenus}>
                            Mi perfil
                        </Link>
                    )}
                    <form action={cerrarSesionYVolverAlInicio} onSubmit={cerrarMenus}>
                        <button type="submit" className={estilos.opcionDesplegable} role="menuitem">
                            Cerrar sesión
                        </button>
                    </form>
                </div>
            )}
        </div>
    );

    const menuPerfilMobile = rolUsuario && (esProductor ? (
        <Link href="/mi-perfil/productor" className={`${estilos.enlaceMobile} ${estilos.perfilMobile}`} onClick={cerrarMenus}>
            <span className={estilos.etiquetaMenuMobile}>
                <AccountCircleOutlinedIcon className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />
                Mi perfil
            </span>
        </Link>
    ) : (
        <Link href="/mi-perfil" className={`${estilos.enlaceMobile} ${estilos.perfilMobile}`} onClick={cerrarMenus}>
            <span className={estilos.etiquetaMenuMobile}>
                <AccountCircleOutlinedIcon className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />
                Mi perfil
            </span>
            {fotoPerfil && !fotoPerfilFallida && (
                <Image
                    src={fotoPerfil}
                    alt=""
                    unoptimized={fotoPerfil.startsWith("/api/")}
                    width={32}
                    height={32}
                    className={estilos.fotoPerfilMobile}
                    onError={() => cambiarFotoPerfilFallida(true)}
                />
            )}
        </Link>
    ));

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
                        {opcionesNavegacion.map((opcion) =>
                            esAdministrador && opcion.ruta === "/publicaciones" ? (
                                <MenuPublicaciones
                                    key={opcion.ruta}
                                    rutaActual={rutaActual}
                                    onNavigate={() => cambiarMenuAbierto(false)}
                                />
                            ) : (
                                <Link
                                    key={opcion.ruta}
                                    href={opcion.ruta}
                                    aria-current={esRutaActiva(opcion.ruta) ? "page" : undefined}
                                    className={`${estilos.enlace} ${
                                        esRutaActiva(opcion.ruta) ? estilos.enlaceActivo : ""
                                    }`}
                                >
                                    {opcion.nombre}
                                </Link>
                            ),
                        )}
                    </nav>
                    {menuUsuario}
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
                        <ContadorNotificaciones cantidad={noLeidas} enEsquina />
                    </button>
                    {rolUsuario && <span id={descripcionNotificacionesId} className={estilos.descripcionNotificaciones}>{noLeidas} {noLeidas === 1 ? "notificación sin leer" : "notificaciones sin leer"}</span>}
                </div>
                <nav
                    id="menu-mobile"
                    className={`${estilos.navegacionMobile} ${menuAbierto ? estilos.navegacionMobileAbierta : ""}`}
                    aria-label="Navegación móvil"
                >
                    {menuPerfilMobile}
                    {rolUsuario && <Link href="/notificaciones" className={`${estilos.enlaceMobile} ${estilos.enlaceNotificaciones}`} aria-current={esRutaActiva("/notificaciones") ? "page" : undefined} aria-describedby={noLeidas > 0 ? descripcionNotificacionesId : undefined} onClick={cerrarMenus}>
                        <span className={estilos.etiquetaMenuMobile}><NotificationsNoneOutlinedIcon className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />Notificaciones</span>
                        <ContadorNotificaciones cantidad={noLeidas} />
                    </Link>}
                    {opcionesNavegacion.map((opcion) =>
                        esAdministrador && opcion.ruta === "/publicaciones" ? (
                            <MenuPublicaciones
                                key={opcion.ruta}
                                mobile
                                rutaActual={rutaActual}
                                onNavigate={() => cambiarMenuAbierto(false)}
                            />
                        ) : (
                            <Link
                                key={opcion.ruta}
                                href={opcion.ruta}
                                aria-current={esRutaActiva(opcion.ruta) ? "page" : undefined}
                                className={estilos.enlaceMobile}
                                onClick={() => cambiarMenuAbierto(false)}
                            >
                                <opcion.icono className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />
                                {opcion.nombre}
                            </Link>
                        ),
                    )}
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
