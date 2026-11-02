"use client";

import { useEffect, useRef } from "react";

export default function SeguimientoVisita() {
    const yaDisparado = useRef(false);

    useEffect(() => {
        if (yaDisparado.current) return;
        yaDisparado.current = true;
        fetch("/api/estadisticas/visitas", { method: "GET" }).catch(() => {});
    }, []);

    return null;
}