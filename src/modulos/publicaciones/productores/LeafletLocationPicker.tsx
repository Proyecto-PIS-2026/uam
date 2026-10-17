"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./LeafletLocationPicker.module.css";

export type UbicacionSeleccionada = {
    latitud: number;
    longitud: number;
    departamento: string;
    nombreLugar: string | null;
};

type Props = {
    abierto: boolean;
    coordenadas: UbicacionSeleccionada | null;
    alConfirmar: (coordenadas: UbicacionSeleccionada) => void;
    alCerrar: () => void;
};

type ResultadoBusqueda = {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
};

const CENTRO_URUGUAY: [number, number] = [-32.5228, -55.7658];

export default function LeafletLocationPicker({ abierto, coordenadas, alConfirmar, alCerrar }: Props) {
    const mapaRef = useRef<HTMLDivElement>(null);
    const mapaInstanciaRef = useRef<LeafletMap | null>(null);
    const marcadorRef = useRef<CircleMarker | null>(null);
    const seleccionarCoordenadasRef = useRef<((latitud: number, longitud: number) => Promise<void>) | null>(null);
    const [seleccion, setSeleccion] = useState<UbicacionSeleccionada | null>(coordenadas);
    const [error, setError] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
    const [buscando, setBuscando] = useState(false);

    useEffect(() => {
        if (!abierto || !mapaRef.current) return;
        const elementoMapa = mapaRef.current;
        let activo = true;
        let temporizadorTamano: ReturnType<typeof setTimeout> | undefined;
        setError("");

        void import("leaflet").then((leaflet) => {
            if (!activo || !elementoMapa.isConnected) return;
            const inicial = coordenadas;
            const centro: [number, number] = inicial ? [inicial.latitud, inicial.longitud] : CENTRO_URUGUAY;
            const mapa = leaflet.map(elementoMapa).setView(centro, inicial ? 14 : 6);
            mapaInstanciaRef.current = mapa;
            leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "&copy; OpenStreetMap contributors",
            }).addTo(mapa);
            temporizadorTamano = setTimeout(() => {
                if (activo) mapa.invalidateSize();
            }, 250);

            const marcar = async (latitud: number, longitud: number) => {
                setError("");
                try {
                    const respuesta = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitud)}&lon=${encodeURIComponent(longitud)}&zoom=18&addressdetails=1`, { headers: { "Accept-Language": "es" } });
                    if (!respuesta.ok) throw new Error("No se pudo identificar la ubicación.");
                    const datos = await respuesta.json() as { display_name?: string; address?: { country_code?: string; state?: string; county?: string; city?: string; town?: string; village?: string; suburb?: string; neighbourhood?: string; road?: string } };
                    if (datos.address?.country_code?.toLowerCase() !== "uy") throw new Error("La ubicación debe estar dentro de Uruguay.");
                    const departamento = datos.address?.state ?? datos.address?.county;
                    if (!departamento) throw new Error("No se pudo identificar el departamento.");
                    const nombreLugar = datos.address?.road ?? datos.address?.neighbourhood ?? datos.address?.suburb ?? datos.address?.town ?? datos.address?.city ?? datos.display_name?.split(",")[0] ?? null;
                    const nueva = { latitud, longitud, departamento, nombreLugar };
                    setSeleccion(nueva);
                    if (marcadorRef.current) marcadorRef.current.setLatLng([latitud, longitud]);
                    else marcadorRef.current = leaflet.circleMarker([latitud, longitud], { radius: 8, color: "#176b58", fillColor: "#176b58", fillOpacity: 0.9 }).addTo(mapa);
                } catch (razon) {
                    setSeleccion(null);
                    setError(razon instanceof Error ? razon.message : "No se pudo identificar la ubicación.");
                }
            };
            seleccionarCoordenadasRef.current = marcar;

            if (inicial) {
                marcadorRef.current = leaflet.circleMarker(centro, { radius: 8, color: "#176b58", fillColor: "#176b58", fillOpacity: 0.9 }).addTo(mapa);
            }
            mapa.on("click", (evento) => { void marcar(evento.latlng.lat, evento.latlng.lng); });
        }).catch(() => { if (activo) setError("No se pudo cargar el mapa."); });

        return () => {
            activo = false;
            if (temporizadorTamano !== undefined) clearTimeout(temporizadorTamano);
            marcadorRef.current = null;
            seleccionarCoordenadasRef.current = null;
            mapaInstanciaRef.current?.remove();
            mapaInstanciaRef.current = null;
        };
    }, [abierto, coordenadas]);

    async function buscarLugar(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        const consulta = busqueda.trim();
        if (!consulta) return;
        setBuscando(true);
        setError("");
        try {
            const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=uy&q=${encodeURIComponent(consulta)}`, {
                headers: { "Accept-Language": "es" },
            });
            if (!respuesta.ok) throw new Error("No se pudo buscar el lugar.");
            const datos = await respuesta.json() as ResultadoBusqueda[];
            setResultados(datos);
            if (datos.length === 0) setError("No se encontraron lugares para esa búsqueda.");
        } catch (razon) {
            setResultados([]);
            setError(razon instanceof Error ? razon.message : "No se pudo buscar el lugar.");
        } finally {
            setBuscando(false);
        }
    }

    function elegirResultado(resultado: ResultadoBusqueda) {
        const latitud = Number(resultado.lat);
        const longitud = Number(resultado.lon);
        setBusqueda(resultado.display_name);
        setResultados([]);
        mapaInstanciaRef.current?.setView([latitud, longitud], 16);
        if (seleccionarCoordenadasRef.current) void seleccionarCoordenadasRef.current(latitud, longitud);
    }

    if (!abierto) return null;
    return <div className={styles.fondo} role="presentation">
        <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="titulo-ubicacion-productor">
            <header className={styles.encabezado}>
                <h2 id="titulo-ubicacion-productor">Seleccionar ubicación</h2>
                <button type="button" className={styles.cerrar} onClick={alCerrar} aria-label="Cerrar mapa">×</button>
            </header>
            <p className={styles.ayuda}>Haz click para seleccionar una ubicación en el mapa o busca por nombre:</p>
            <form className={styles.buscador} onSubmit={buscarLugar}>
                <div className={styles.controlesBusqueda}>
                    <input id="buscar-ubicacion-productor" aria-label="Buscar ubicación por nombre" type="search" value={busqueda} onChange={(evento) => { setBusqueda(evento.target.value); setResultados([]); }} placeholder="Ej.: Mercado Modelo, Montevideo" />
                    <button type="submit" disabled={buscando || !busqueda.trim()}>{buscando ? "Buscando..." : "Buscar"}</button>
                </div>
                {resultados.length > 0 && <ul className={styles.resultados} aria-label="Resultados de búsqueda">
                    {resultados.map((resultado) => <li key={resultado.place_id}><button type="button" onClick={() => elegirResultado(resultado)}>{resultado.display_name}</button></li>)}
                </ul>}
            </form>
            <div className={styles.mapaContenedor}>
                <div className={styles.mapa} ref={mapaRef} />
                {error && <p className={styles.error} role="alert">{error}</p>}
            </div>
            {seleccion && <p className={styles.coordenadas}>{seleccion.nombreLugar ? `${seleccion.nombreLugar}, ` : ""}{seleccion.departamento}</p>}
            <footer className={styles.pie}>
                <button type="button" className={styles.cancelar} onClick={alCerrar}>Cancelar</button>
                <button type="button" className={styles.confirmar} onClick={() => seleccion && alConfirmar(seleccion)} disabled={!seleccion || Boolean(error)}>Usar esta ubicación</button>
            </footer>
        </section>
    </div>;
}
