"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { usePathname } from "next/navigation";

import styles from "./HeaderPublico.module.css";

const opcionesMenu = [
    {
        nombre: "Inicio",
        ruta: "/inicio",
    },
    {
        nombre: "Catálogo",
        ruta: "/publicaciones",
    },
    {
        nombre: "Listado de operadores",
        ruta: "/operadores",
    },
    {
        nombre: "Perfil público de operador",
        ruta: "/operadores/1",
    },
    {
        nombre: "Mi mercado",
        ruta: "/COMPLETAR-RUTA-MI-MERCADO",
    },
];

export default function HeaderPublico() {
    const [menuAbierto, setMenuAbierto] = useState(false);
    const pathname = usePathname();

    const contenido = (
        <header className={styles.header}>
            <div className={styles.contenido}>
                <div className={styles.marca}>
                    <Image src="/Logo.PNG" alt="Unidad Agroalimentaria Metropolitana" width={410} height={94} priority className={styles.logo}/>
                </div>
                <nav className={styles.navegacion} aria-label="Navegación principal">
                    {opcionesMenu.map((opcion) => (
                        <Link
                            key={opcion.nombre}
                            href={opcion.ruta}
                            className={`${styles.enlace} ${
                                pathname === opcion.ruta ? styles.enlaceActivo : ""
                            }`}
                        >
                            {opcion.nombre}
                        </Link>
                    ))}
                </nav>

                <button className={styles.menuMobile} type="button" onClick={() => setMenuAbierto((abierto) => !abierto)} aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuAbierto} aria-controls="menu-mobile">
                    <MenuIcon className={`${styles.iconoMenu} ${menuAbierto ? styles.iconoMenuOculto : styles.iconoMenuVisible}`}/>
                    <CloseIcon className={`${styles.iconoMenu} ${menuAbierto ? styles.iconoCerrarVisible : styles.iconoCerrarOculto}`}/>
                </button>
            </div>

            <nav id="menu-mobile" className={`${styles.navegacionMobile} ${menuAbierto ? styles.navegacionMobileAbierta : ""}`} aria-label="Navegación móvil">
                {opcionesMenu.map((opcion) => (
                    <Link key={opcion.nombre} href={opcion.ruta} className={styles.enlaceMobile} onClick={() => setMenuAbierto(false)}>
                        {opcion.nombre}
                    </Link>
                ))}
            </nav>
        </header>
    );

    return contenido;
}