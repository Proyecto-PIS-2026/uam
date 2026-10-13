"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./ContenedorConfiguracionGeneral.module.css";

const pestañas = [
    { id: "publicaciones", etiqueta: "Publicaciones" },
    { id: "usuarios", etiqueta: "Usuarios" },
    { id: "publico", etiqueta: "Público" },
] as const;

type IdPestaña = typeof pestañas[number]["id"];

interface ContenedorConfiguracionGeneralProps {
    publicaciones: ReactNode;
    usuarios: ReactNode;
    publica: ReactNode;
}

function suscribirCambiosHash(callback: () => void) {
    if (typeof window === "undefined") return () => {};

    window.addEventListener("hashchange", callback);
    window.addEventListener("popstate", callback);

    return () => {
        window.removeEventListener("hashchange", callback);
        window.removeEventListener("popstate", callback);
    };
}

function obtenerPestañaActual(): IdPestaña {
    const hash = window.location.hash.slice(1);
    return pestañas.some((pestaña) => pestaña.id === hash) ? hash as IdPestaña : pestañas[0].id;
}

function obtenerPestañaServidor(): IdPestaña {
    return pestañas[0].id;
}

export default function ContenedorConfiguracionGeneral({ publicaciones, usuarios, publica }: ContenedorConfiguracionGeneralProps) {
    const router = useRouter();
    const [pestañaLocal, setPestañaLocal] = useState<IdPestaña | null>(null);

    const pestañaURL = useSyncExternalStore(suscribirCambiosHash, obtenerPestañaActual, obtenerPestañaServidor);

    const pestañaSeleccionada = pestañaLocal ?? pestañaURL;

    useEffect(() => {
        function sincronizarPestaña() {
            setPestañaLocal(null);
        }

        window.addEventListener("hashchange", sincronizarPestaña);
        window.addEventListener("popstate", sincronizarPestaña);

        return () => {
            window.removeEventListener("hashchange", sincronizarPestaña);
            window.removeEventListener("popstate", sincronizarPestaña);
        };
    }, []);

    const contenidos: Record<IdPestaña, ReactNode> = {
        "publicaciones": publicaciones,
        "usuarios": usuarios,
        "publico": publica,
    };

    function seleccionarPestaña(id: IdPestaña) {
        setPestañaLocal(id);
        if (window.location.hash !== `#${id}`) router.push(`${window.location.pathname}${window.location.search}#${id}`, { scroll: false });
    }

    return (
        <section className={styles.contenedor}>
            <div className={styles.botones} role="group" aria-label="Secciones de configuración">
                {pestañas.map((pestaña) => (
                    <button key={pestaña.id} type="button" aria-pressed={pestañaSeleccionada === pestaña.id} aria-controls="panel-configuracion" className={styles.boton} onClick={() => seleccionarPestaña(pestaña.id)}>
                        {pestaña.etiqueta}
                    </button>
                ))}
            </div>

            <div id="panel-configuracion" className={styles.panel}>
                {contenidos[pestañaSeleccionada]}
            </div>
        </section>
    );
}