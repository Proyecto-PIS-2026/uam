"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { usePathname } from "next/navigation";
import type { RolUsuario } from "@/modulos/identidad-acceso/autenticacion/sesiones";

import estilos from "./HeaderPublico.module.css";

type OpcionMenu = {
    nombre: string;
    ruta: string;
    rol?: RolUsuario;
    soloSinSesion?: boolean;
};

const opcionesMenu: OpcionMenu[] = [
    {
        nombre: "Inicio",
        ruta: "/inicio",
    },
    {
        nombre: "Publicaciones",
        ruta: "/publicaciones",
    },
    {
        nombre: "Operadores",
        ruta: "/operadores",
    },
    {
        nombre: "Precios de referencia",
        ruta: "/precios-referencia",
    },
    {
        nombre: "Mi mercado",
        ruta: "/mi-mercado",
        rol: "OPERADOR",
    },
    {
        nombre: "Mi mercado",
        ruta: "/mi-mercado/productor",
        rol: "PRODUCTOR",
    },
    {
        nombre: "Iniciar sesión",
        ruta: "/iniciar-sesion",
        soloSinSesion: true,
    },
];

type PropiedadesEncabezado = {
    rolUsuario: RolUsuario | null;
};

export default function HeaderPublico({ rolUsuario }: PropiedadesEncabezado) {
    const [menuAbierto, cambiarMenuAbierto] = useState(false);
    const [menuUsuarioAbierto, cambiarMenuUsuarioAbierto] = useState(false);
    const referenciaMenuUsuario = useRef<HTMLDivElement>(null);
    const rutaActual = usePathname() ?? "";
    const opcionesVisibles = opcionesMenu.filter(
        (opcion) =>
            (!opcion.rol || opcion.rol === rolUsuario) &&
            (!opcion.soloSinSesion || rolUsuario === null),
    );

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

    const menuUsuario = rolUsuario && (
        <div ref={referenciaMenuUsuario} className={estilos.menuOperador}>
            <button
                type="button"
                className={estilos.botonOperador}
                aria-label="Abrir menú de usuario"
                aria-expanded={menuUsuarioAbierto}
                onClick={() => cambiarMenuUsuarioAbierto((abierto) => !abierto)}
            >
                <AccountCircleIcon className={estilos.iconoOperador} />
            </button>
            {menuUsuarioAbierto && (
                <div className={estilos.desplegableOperador} role="menu">
                    <span className={estilos.opcionDesplegable} role="menuitem">
                        Cerrar sesión
                    </span>
                </div>
            )}
        </div>
    );

    const contenido = (
        <>
            <header className={estilos.header}>
                <div className={estilos.contenido}>
                    <Link
                        href="/inicio"
                        className={estilos.marca}
                        aria-label="Ir al inicio"
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
                        {opcionesVisibles.map((opcion) => (
                            <Link
                                key={opcion.ruta}
                                href={opcion.ruta}
                                aria-current={esRutaActiva(opcion.ruta) ? "page" : undefined}
                                className={`${estilos.enlace} ${esRutaActiva(opcion.ruta) ? estilos.enlaceActivo : ""}`}
                            >
                                {opcion.nombre}
                            </Link>
                        ))}
                    </nav>
                    {menuUsuario}
                    <button
                        className={estilos.menuMobile}
                        type="button"
                        onClick={() => cambiarMenuAbierto((abierto) => !abierto)}
                        aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
                        aria-expanded={menuAbierto}
                        aria-controls="menu-mobile"
                    >
                        <MenuIcon
                            className={`${estilos.iconoMenu} ${menuAbierto ? estilos.iconoMenuOculto : estilos.iconoMenuVisible}`}
                        />
                        <CloseIcon
                            className={`${estilos.iconoMenu} ${menuAbierto ? estilos.iconoCerrarVisible : estilos.iconoCerrarOculto}`}
                        />
                    </button>
                </div>
                <nav
                    id="menu-mobile"
                    className={`${estilos.navegacionMobile} ${menuAbierto ? estilos.navegacionMobileAbierta : ""}`}
                    aria-label="Navegación móvil"
                >
                    {opcionesVisibles.map((opcion) => (
                        <Link
                            key={opcion.ruta}
                            href={opcion.ruta}
                            aria-current={esRutaActiva(opcion.ruta) ? "page" : undefined}
                            className={estilos.enlaceMobile}
                            onClick={() => cambiarMenuAbierto(false)}
                        >
                            {opcion.nombre}
                        </Link>
                    ))}
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
