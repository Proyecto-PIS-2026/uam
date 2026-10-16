"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./LeafletLocationPicker.module.css";

type Coordenadas = { latitud: number; longitud: number; departamentoId: number };
type Departamento = { id: number; nombre: string };

type Props = {
    abierto: boolean;
    coordenadas: Coordenadas | null;
    departamentos: Departamento[];
    alConfirmar: (coordenadas: Coordenadas) => void;
    alCerrar: () => void;
};

const CENTRO_URUGUAY: [number, number] = [-32.5228, -55.7658];

function normalizarNombre(nombre: string): string {
    return nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
        .replace(/^departamento\s+(de\s+)?/, "").trim();
}

function departamentoIdParaNombre(nombre: string, departamentos: Departamento[]): number | null {
    const normalizado = normalizarNombre(nombre);
    const departamento = departamentos.find((opcion) => {
        const catalogo = normalizarNombre(opcion.nombre);
        return normalizado === catalogo || normalizado.includes(catalogo) || catalogo.includes(normalizado);
    });
    return departamento?.id ?? null;
}

async function obtenerDepartamento(latitud: number, longitud: number, departamentos: Departamento[]): Promise<number> {
    const respuesta = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitud)}&lon=${encodeURIComponent(longitud)}&zoom=10&addressdetails=1`, {
        headers: { "Accept-Language": "es" },
    });
    if (!respuesta.ok) throw new Error("No se pudo identificar el departamento.");
    const datos = await respuesta.json() as { address?: { country_code?: string; state?: string; county?: string; state_district?: string } };
    if (datos.address?.country_code !== "uy") throw new Error("La ubicación debe estar dentro de Uruguay.");
    const nombre = datos.address?.state ?? datos.address?.state_district ?? datos.address?.county;
    const departamentoId = nombre ? departamentoIdParaNombre(nombre, departamentos) : null;
    if (departamentoId === null) throw new Error("La ubicación no corresponde a un departamento disponible.");
    return departamentoId;
}

export default function LeafletLocationPicker({ abierto, coordenadas, departamentos, alConfirmar, alCerrar }: Props) {
    const mapaRef = useRef<HTMLDivElement>(null);
    const mapaInstanciaRef = useRef<LeafletMap | null>(null);
    const marcadorRef = useRef<CircleMarker | null>(null);
    const [seleccion, setSeleccion] = useState<Coordenadas | null>(coordenadas);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => setSeleccion(coordenadas), [coordenadas]);

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

            const marcar = async (latitud: number, longitud: number) => {
                setCargando(true);
                setError("");
                try {
                    const departamentoId = await obtenerDepartamento(latitud, longitud, departamentos);
                    if (!activo) return;
                    const nueva = { latitud, longitud, departamentoId };
                    setSeleccion(nueva);
                    if (marcadorRef.current) marcadorRef.current.setLatLng([latitud, longitud]);
                    else marcadorRef.current = leaflet.circleMarker([latitud, longitud], { radius: 8, color: "#176b58", fillColor: "#176b58", fillOpacity: 0.9 }).addTo(mapa);
                } catch (razon) {
                    if (activo) {
                        setSeleccion(null);
                        setError(razon instanceof Error ? razon.message : "No se pudo identificar la ubicación.");
                    }
                } finally {
                    if (activo) setCargando(false);
                }
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
    }, [abierto, coordenadas, departamentos]);

    if (!abierto) return null;
    return <div className={styles.fondo} role="presentation">
        <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="titulo-ubicacion-productor">
            <header className={styles.encabezado}>
                <h2 id="titulo-ubicacion-productor">Seleccionar ubicación</h2>
                <button type="button" className={styles.cerrar} onClick={alCerrar} aria-label="Cerrar mapa">×</button>
            </header>
            <p className={styles.ayuda}>Hacé clic en el mapa. El departamento se identificará automáticamente.</p>
            <div className={styles.mapa} ref={mapaRef}>{cargando && <p className={styles.estado}>Identificando ubicación...</p>}{error && <p className={styles.error} role="alert">{error}</p>}</div>
            {seleccion && <p className={styles.coordenadas}>Latitud: {seleccion.latitud.toFixed(6)} · Longitud: {seleccion.longitud.toFixed(6)}</p>}
            <footer className={styles.pie}>
                <button type="button" className={styles.cancelar} onClick={alCerrar}>Cancelar</button>
                <button type="button" className={styles.confirmar} onClick={() => seleccion && alConfirmar(seleccion)} disabled={!seleccion || cargando || Boolean(error)}>Usar esta ubicación</button>
            </footer>
        </section>
    </div>;
}
