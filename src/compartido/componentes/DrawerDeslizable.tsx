"use client";

import { useLayoutEffect, useRef, type PointerEvent } from "react";
import Drawer, { type DrawerProps } from "@mui/material/Drawer";
import styles from "./DrawerDeslizable.module.css";

type Props = Omit<DrawerProps, "onClose"> & {
    onClose: () => void;
    arrastreDeshabilitado?: boolean;
};

type Arrastre = {
    puntero: number;
    asa: HTMLDivElement;
    panel: HTMLElement;
    inicioX: number;
    inicioY: number;
    ultimoY: number;
    ultimoTiempo: number;
    velocidad: number;
    distancia: number;
    transformacion: string;
    transicion: string;
};

function liberarPuntero(arrastre: Arrastre) {
    if (arrastre.asa.hasPointerCapture?.(arrastre.puntero)) {
        arrastre.asa.releasePointerCapture(arrastre.puntero);
    }
}

function restaurarPosicion(arrastre: Arrastre, animar = true) {
    const reducirMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    arrastre.panel.style.transition = arrastre.distancia === 0 ? arrastre.transicion
        : animar && !reducirMovimiento ? "transform 180ms cubic-bezier(0.2, 0, 0, 1)" : "none";
    arrastre.panel.style.transform = arrastre.transformacion;
}

export default function DrawerDeslizable({
    anchor = "left", open = false, onClose, arrastreDeshabilitado = false, children, ...props
}: Props) {
    const arrastreRef = useRef<Arrastre | null>(null);
    const revisionCierreRef = useRef<number | null>(null);
    const estadoRef = useRef({ open, anchor, arrastreDeshabilitado });

    useLayoutEffect(() => {
        estadoRef.current = { open, anchor, arrastreDeshabilitado };
        const arrastre = arrastreRef.current;
        if (arrastre && (!open || anchor !== "bottom" || arrastreDeshabilitado)) {
            arrastreRef.current = null;
            liberarPuntero(arrastre);
            if (open) restaurarPosicion(arrastre, false);
        }
    }, [open, anchor, arrastreDeshabilitado]);

    useLayoutEffect(() => () => {
        if (revisionCierreRef.current !== null) cancelAnimationFrame(revisionCierreRef.current);
        const arrastre = arrastreRef.current;
        arrastreRef.current = null;
        if (arrastre) {
            liberarPuntero(arrastre);
            restaurarPosicion(arrastre, false);
        }
    }, []);

    function iniciar(evento: PointerEvent<HTMLDivElement>) {
        if (!evento.isPrimary || evento.button !== 0) return;
        evento.preventDefault();
        if (!open || arrastreDeshabilitado || anchor !== "bottom" || arrastreRef.current) return;
        const panel = evento.currentTarget.closest<HTMLElement>(".MuiDrawer-paper");
        if (!panel) return;
        if (revisionCierreRef.current !== null) {
            cancelAnimationFrame(revisionCierreRef.current);
            revisionCierreRef.current = null;
        }
        arrastreRef.current = {
            puntero: evento.pointerId, asa: evento.currentTarget, panel,
            inicioX: evento.clientX, inicioY: evento.clientY,
            ultimoY: evento.clientY, ultimoTiempo: evento.timeStamp, velocidad: 0, distancia: 0,
            transformacion: panel.style.transform, transicion: panel.style.transition,
        };
        evento.currentTarget.setPointerCapture?.(evento.pointerId);
        panel.style.transition = "none";
    }

    function mover(evento: PointerEvent<HTMLDivElement>) {
        const arrastre = arrastreRef.current;
        if (!arrastre || arrastre.puntero !== evento.pointerId) return;
        const vertical = evento.clientY - arrastre.inicioY;
        const horizontal = Math.abs(evento.clientX - arrastre.inicioX);
        arrastre.distancia = vertical > horizontal ? Math.max(0, vertical) : 0;
        const tiempo = evento.timeStamp - arrastre.ultimoTiempo;
        if (tiempo > 0) arrastre.velocidad = (evento.clientY - arrastre.ultimoY) / tiempo;
        arrastre.ultimoY = evento.clientY;
        arrastre.ultimoTiempo = evento.timeStamp;
        // Slide reconoce translate(x, y) y continúa la salida desde esta posición.
        arrastre.panel.style.transform = `translate(0px, ${arrastre.distancia}px)`;
        evento.preventDefault();
    }

    function terminar(evento: PointerEvent<HTMLDivElement>, cancelado = false) {
        const arrastre = arrastreRef.current;
        if (!arrastre || arrastre.puntero !== evento.pointerId) return;
        arrastreRef.current = null;
        liberarPuntero(arrastre);
        const umbral = Math.min(120, Math.max(64, arrastre.panel.offsetHeight * 0.2));
        const impulso = evento.timeStamp - arrastre.ultimoTiempo < 100 && arrastre.velocidad > 0.6;
        const cerrar = !cancelado && open && !arrastreDeshabilitado
            && (arrastre.distancia >= umbral || (arrastre.distancia > 24 && impulso));
        if (!cerrar) {
            restaurarPosicion(arrastre);
            return;
        }
        onClose();
        // Si una confirmación o una operación pendiente veta el cierre, el panel vuelve.
        revisionCierreRef.current = requestAnimationFrame(() => {
            revisionCierreRef.current = null;
            if (estadoRef.current.open && arrastre.panel.isConnected && !arrastreRef.current) restaurarPosicion(arrastre);
        });
    }

    return (
        <Drawer {...props} anchor={anchor} open={open} onClose={onClose}>
            {anchor === "bottom" && (
                <div
                    className={styles.asa}
                    data-drawer-handle
                    data-disabled={arrastreDeshabilitado || !open}
                    aria-hidden="true"
                    onPointerDown={iniciar}
                    onPointerMove={mover}
                    onPointerUp={(evento) => terminar(evento)}
                    onPointerCancel={(evento) => terminar(evento, true)}
                    onLostPointerCapture={(evento) => terminar(evento, true)}
                ><span /></div>
            )}
            {children}
        </Drawer>
    );
}
