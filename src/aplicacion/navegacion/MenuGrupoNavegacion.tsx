"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import type { OpcionMenu } from "./opciones-navegacion";
import estilos from "./EncabezadoAplicacion.module.css";

export default function MenuGrupoNavegacion({
    nombre,
    icono: Icono,
    opciones,
    mobile = false,
    rutaActual,
    onNavigate,
}: {
    nombre: string;
    icono: OpcionMenu["icono"];
    opciones: Pick<OpcionMenu, "nombre" | "ruta" | "icono">[];
    mobile?: boolean;
    rutaActual: string;
    onNavigate: () => void;
}) {
    const [abierto, setAbierto] = useState(false);
    const referencia = useRef<HTMLDivElement>(null);
    const botonRef = useRef<HTMLButtonElement>(null);
    const id = useId();

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
            className={estilos.grupoMenu}
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
                    estilos.botonGrupoMenu,
                    activo ? estilos.enlaceActivo : "",
                ].join(" ")}
                aria-expanded={abierto}
                aria-controls={id}
                onClick={() => setAbierto((valor) => !valor)}
            >
                {mobile ? (
                    <span className={estilos.etiquetaMenuMobile}>
                        <Icono className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />
                        {nombre}
                    </span>
                ) : nombre}
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
                    estilos.listaGrupoMenu,
                    abierto ? estilos.listaGrupoMenuAbierta : "",
                    mobile ? estilos.listaGrupoMenuMobile : "",
                ].join(" ")}
            >
                {opciones.map((opcion) => (
                    <Link
                        key={opcion.ruta}
                        href={opcion.ruta}
                        aria-current={esActiva(opcion.ruta) ? "page" : undefined}
                        className={[
                            estilos.opcionGrupoMenu,
                            esActiva(opcion.ruta)
                                ? estilos.opcionGrupoMenuActiva
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
