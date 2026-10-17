"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NuevaPublicacion from "@/modulos/publicaciones/operadores/componentes/NuevaPublicacion";

type Props = {
    operadorId: number;
};

export default function BotonAltaPublicacionAdmin({ operadorId }: Props) {
    const [altaAbierta, setAltaAbierta] = useState(false);
    const [mensaje, setMensaje] = useState("");
    const [mostrarFlotante, setMostrarFlotante] = useState(false);

    const botonRef = useRef<HTMLButtonElement>(null);
    const router = useRouter();

    useEffect(() => {
        const boton = botonRef.current;
        if (!boton) return;

        const observador = new IntersectionObserver(([entrada]) => {
            setMostrarFlotante(!entrada.isIntersecting && entrada.boundingClientRect.bottom < 0);
        });

        observador.observe(boton);

        return () => observador.disconnect();
    }, []);

    function abrirAlta() {
        setMensaje("");
        setAltaAbierta(true);
    }

    function cerrarAlta() {
        setAltaAbierta(false);
    }

    function publicacionCreada(aviso: string) {
        cerrarAlta();
        setMensaje(aviso);
        router.refresh();
    }

    return (
        <>
            {/* Botón original */}
            <button
                ref={botonRef}
                type="button"
                onClick={abrirAlta}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white"
            >
                Nueva publicación
            </button>

            {/* Botón flotante para móvil */}
            {mostrarFlotante && !altaAbierta && (
                <button
                    type="button"
                    onClick={abrirAlta}
                    aria-label="Nueva publicación"
                    title="Nueva publicación"
                    className="cursor-pointer rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >+</button>
            )}

            {mensaje && <p role="status">{mensaje}</p>}

            {altaAbierta && (
                <NuevaPublicacion operadorId={operadorId} abierto={altaAbierta} alCerrar={cerrarAlta} alCrear={publicacionCreada}/>
            )}
        </>
    );
}