"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./LeafletLocationPicker.module.css";

type Coordenadas = { latitud: number; longitud: number };

type Props = {
    abierto: boolean;
    coordenadas: Coordenadas | null;
    alConfirmar: (coordenadas: Coordenadas) => void;
    alCerrar: () => void;
};

const CENTRO_URUGUAY: [number, number] = [-32.5228, -55.7658];

export default function LeafletLocationPicker({ abierto, coordenadas, alConfirmar, alCerrar }: Props) {
    const mapaRef = useRef<HTMLDivElement>(null);
    const mapaInstanciaRef = useRef<LeafletMap | null>(null);
    const marcadorRef = useRef<CircleMarker | null>(null);
    const [seleccion, setSeleccion] = useState<Coordenadas | null>(coordenadas);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!abierto || !mapaRef.current) return;
        let activo = true;
        let temporizadorTamano: ReturnType<typeof setTimeout> | undefined;
        setError("");

        void import("leaflet").then((leaflet) => {
            if (!activo || !mapaRef.current) return;
            const inicial = coordenadas;
            const centro: [number, number] = inicial ? [inicial.latitud, inicial.longitud] : CENTRO_URUGUAY;
            const mapa = leaflet.map(mapaRef.current).setView(centro, inicial ? 14 : 6);
            mapaInstanciaRef.current = mapa;
            leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "&copy; OpenStreetMap contributors",
            }).addTo(mapa);
            temporizadorTamano = setTimeout(() => {
                if (activo) mapa.invalidateSize();
            }, 250);

            const marcar = (latitud: number, longitud: number) => {
                setError("");
                const nueva = { latitud, longitud };
                setSeleccion(nueva);
                if (marcadorRef.current) marcadorRef.current.setLatLng([latitud, longitud]);
                else marcadorRef.current = leaflet.circleMarker([latitud, longitud], { radius: 8, color: "#176b58", fillColor: "#176b58", fillOpacity: 0.9 }).addTo(mapa);
            };

            if (inicial) {
                marcadorRef.current = leaflet.circleMarker(centro, { radius: 8, color: "#176b58", fillColor: "#176b58", fillOpacity: 0.9 }).addTo(mapa);
            }
            mapa.on("click", (evento) => { void marcar(evento.latlng.lat, evento.latlng.lng); });
        }).catch(() => { if (activo) setError("No se pudo cargar el mapa."); });

        return () => {
            activo = false;
            if (temporizadorTamano !== undefined) clearTimeout(temporizadorTamano);
            marcadorRef.current = null;
            mapaInstanciaRef.current?.remove();
            mapaInstanciaRef.current = null;
        };
    }, [abierto, coordenadas]);

    if (!abierto) return null;
    return <div className={styles.fondo} role="presentation">
        <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="titulo-ubicacion-productor">
            <header className={styles.encabezado}>
                <h2 id="titulo-ubicacion-productor">Seleccionar ubicación</h2>
                <button type="button" className={styles.cerrar} onClick={alCerrar} aria-label="Cerrar mapa">×</button>
            </header>
            <p className={styles.ayuda}>Hacé clic en el mapa para seleccionar la ubicación del pickup.</p>
            <div className={styles.mapa} ref={mapaRef}>{error && <p className={styles.error} role="alert">{error}</p>}</div>
            {seleccion && <p className={styles.coordenadas}>Latitud: {seleccion.latitud.toFixed(6)} · Longitud: {seleccion.longitud.toFixed(6)}</p>}
            <footer className={styles.pie}>
                <button type="button" className={styles.cancelar} onClick={alCerrar}>Cancelar</button>
                <button type="button" className={styles.confirmar} onClick={() => seleccion && alConfirmar(seleccion)} disabled={!seleccion || Boolean(error)}>Usar esta ubicación</button>
            </footer>
        </section>
    </div>;
}
