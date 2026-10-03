"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { usePathname } from "next/navigation";

import styles from "./HeaderPublico.module.css";

const opcionesMenu = [
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
        nombre: "Mi mercado",
        ruta: "/mi-mercado",
    },
    {
        nombre: "Iniciar sesión",
        ruta: "/iniciar-sesion",
    },
];

type OperadorAutenticado = {
    id: number;
};

type HeaderPublicoProps = {
    operador: OperadorAutenticado | null;
};

export default function HeaderPublico({ operador }: HeaderPublicoProps) {
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [menuOperadorAbierto, setMenuOperadorAbierto] = useState(false);
    const pathname = usePathname() ?? "";
    const opcionesVisibles = operador
        ? opcionesMenu.filter((opcion) => opcion.ruta !== "/iniciar-sesion")
        : opcionesMenu;

    function esRutaActiva(ruta: string) {
        if (ruta === "/mi-mercado") {
            return pathname === ruta || pathname.startsWith(`${ruta}/`) || pathname.startsWith("/publicaciones/nueva");
        }
        if (ruta === "/publicaciones" && pathname.startsWith("/publicaciones/nueva")) {
            return false;
        }
        return pathname === ruta || pathname.startsWith(`${ruta}/`);
    }

    const menuOperador = operador && (
        <div className={styles.menuOperador}>
            <button type="button" className={styles.botonOperador} aria-label="Abrir menú del operador" aria-expanded={menuOperadorAbierto} onClick={() => setMenuOperadorAbierto((abierto) => !abierto)}>
                <AccountCircleIcon className={styles.iconoOperador} />
            </button>
            {menuOperadorAbierto && (
                <div className={styles.desplegableOperador} role="menu">
                    <span className={styles.opcionDesplegable} role="menuitem">Mi perfil</span>
                    <Link href="/mi-mercado" onClick={() => setMenuOperadorAbierto(false)}>Mi mercado</Link>
                    <span className={styles.opcionDesplegable} role="menuitem">Cerrar sesión</span>
                </div>
            )}
        </div>
    );

    const contenido = (
        <>
            <header className={styles.header}>
                <div className={styles.contenido}>
                    <Link href="/inicio" className={styles.marca} aria-label="Ir al inicio" onClick={() => setMenuAbierto(false)}>
                        <Image src="/Logo.PNG" alt="Unidad Agroalimentaria Metropolitana" width={410} height={94} priority className={styles.logo}/>
                    </Link>
                    <nav className={styles.navegacion} aria-label="Navegación principal">
                        {opcionesVisibles.map((opcion) => (
                            <Link key={opcion.nombre} href={opcion.ruta} aria-current={esRutaActiva(opcion.ruta) ? "page" : undefined} className={`${styles.enlace} ${esRutaActiva(opcion.ruta) ? styles.enlaceActivo : ""}`}>
                                {opcion.nombre}
                            </Link>
                        ))}
                    </nav>
                    {menuOperador}
                    <button className={styles.menuMobile} type="button" onClick={() => setMenuAbierto((abierto) => !abierto)}
                        aria-label={ menuAbierto ? "Cerrar menú" : "Abrir menú" } aria-expanded={menuAbierto} aria-controls="menu-mobile">
                        <MenuIcon className={`${styles.iconoMenu} ${menuAbierto ? styles.iconoMenuOculto : styles.iconoMenuVisible}`}/>
                        <CloseIcon className={`${styles.iconoMenu} ${menuAbierto ? styles.iconoCerrarVisible : styles.iconoCerrarOculto}`}/>
                    </button>
                </div>
                <nav id="menu-mobile" className={`${styles.navegacionMobile} ${menuAbierto ? styles.navegacionMobileAbierta : ""}`} aria-label="Navegación móvil">
                    {opcionesVisibles.map((opcion) => (
                        <Link key={opcion.nombre} href={opcion.ruta} aria-current={esRutaActiva(opcion.ruta) ? "page" : undefined} className={styles.enlaceMobile} onClick={() => setMenuAbierto(false)}>
                            {opcion.nombre}
                        </Link>
                    ))}
                </nav>
            </header>
            {menuAbierto && (<div className={styles.overlayMenu} onMouseDown={() => setMenuAbierto(false)} aria-hidden="true"/>)}
        </>
    );

    return contenido;
}
