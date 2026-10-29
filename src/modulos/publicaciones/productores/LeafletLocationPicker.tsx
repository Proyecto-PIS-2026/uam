"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import CloseIcon from "@mui/icons-material/Close";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import SearchIcon from "@mui/icons-material/Search";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./LeafletLocationPicker.module.css";
import { normalizarDepartamento } from "@/compartido/departamentos-uruguay";

export type UbicacionSeleccionada = {
    latitud: number;
    longitud: number;
    departamento: string;
    nombreLugar: string | null;
};

type Props = {
    abierto: boolean;
    coordenadas: UbicacionSeleccionada | null;
    nombreInicial?: string;
    modo?: "agregar" | "editar";
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

function coordenadasValidas(latitud: number, longitud: number) {
    return Number.isFinite(latitud) && Number.isFinite(longitud) && Math.abs(latitud) <= 90 && Math.abs(longitud) <= 180;
}

function resultadoValido(valor: unknown): valor is ResultadoBusqueda {
    if (!valor || typeof valor !== "object") return false;
    const resultado = valor as Partial<ResultadoBusqueda>;
    return typeof resultado.place_id === "number" && Number.isFinite(resultado.place_id)
        && typeof resultado.display_name === "string" && Boolean(resultado.display_name.trim())
        && typeof resultado.lat === "string" && Boolean(resultado.lat.trim())
        && typeof resultado.lon === "string" && Boolean(resultado.lon.trim())
        && coordenadasValidas(Number(resultado.lat), Number(resultado.lon));
}

export default function LeafletLocationPicker({ abierto, coordenadas, nombreInicial, modo = "agregar", alConfirmar, alCerrar }: Props) {
    const id = useId();
    const esMobile = useMediaQuery("(max-width: 767px)");
    const [elementoMapa, setElementoMapa] = useState<HTMLDivElement | null>(null);
    const mapaInstanciaRef = useRef<LeafletMap | null>(null);
    const marcadorRef = useRef<CircleMarker | null>(null);
    const seleccionarCoordenadasRef = useRef<((latitud: number, longitud: number) => Promise<void>) | null>(null);
    const solicitudBusquedaRef = useRef(0);
    const solicitudSeleccionRef = useRef(0);
    const busquedaAbortRef = useRef<AbortController | null>(null);
    const seleccionAbortRef = useRef<AbortController | null>(null);
    const nombreEditadoRef = useRef(false);
    const [seleccion, setSeleccion] = useState<UbicacionSeleccionada | null>(null);
    const [nombre, setNombre] = useState("");
    const [nombreRevisado, setNombreRevisado] = useState(false);
    const [errorSeleccion, setErrorSeleccion] = useState("");
    const [errorBusqueda, setErrorBusqueda] = useState("");
    const [errorMapa, setErrorMapa] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [identificando, setIdentificando] = useState(false);
    const [mapaListo, setMapaListo] = useState(false);
    const latitudInicial = coordenadas?.latitud ?? null;
    const longitudInicial = coordenadas?.longitud ?? null;
    const departamentoInicial = coordenadas?.departamento ?? "";
    const nombreLugarInicial = nombreInicial ?? coordenadas?.nombreLugar ?? "";

    useEffect(() => {
        if (!abierto || !elementoMapa) return;
        const departamento = normalizarDepartamento(departamentoInicial);
        const inicial = latitudInicial !== null && longitudInicial !== null && coordenadasValidas(latitudInicial, longitudInicial)
            ? { latitud: latitudInicial, longitud: longitudInicial, departamento: departamento ?? "", nombreLugar: nombreLugarInicial }
            : null;
        let activo = true;
        let observador: ResizeObserver | undefined;
        let temporizadorTamano: ReturnType<typeof setTimeout> | undefined;
        nombreEditadoRef.current = Boolean(nombreLugarInicial.trim());
        setNombre(nombreLugarInicial);
        setNombreRevisado(false);
        setSeleccion(inicial?.departamento ? inicial : null);
        setErrorSeleccion("");
        setErrorBusqueda("");
        setErrorMapa("");
        setBusqueda("");
        setResultados([]);
        setBuscando(false);
        setIdentificando(false);
        setMapaListo(false);

        void import("leaflet").then((leaflet) => {
            if (!activo || !elementoMapa.isConnected) return;
            const centro: [number, number] = inicial ? [inicial.latitud, inicial.longitud] : CENTRO_URUGUAY;
            const mapa = leaflet.map(elementoMapa).setView(centro, inicial ? 14 : 6);
            mapaInstanciaRef.current = mapa;
            leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "&copy; OpenStreetMap contributors",
            }).addTo(mapa);
            const ajustarTamano = () => { if (activo) mapa.invalidateSize(); };
            temporizadorTamano = setTimeout(ajustarTamano, 250);
            if (typeof ResizeObserver !== "undefined") {
                observador = new ResizeObserver(ajustarTamano);
                observador.observe(elementoMapa);
            }
            const colorMarcador = getComputedStyle(elementoMapa).getPropertyValue("--color-secondary").trim() || "#005d29";
            const ponerMarcador = (latitud: number, longitud: number, provisional: boolean) => {
                marcadorRef.current?.remove();
                marcadorRef.current = leaflet.circleMarker([latitud, longitud], {
                    radius: 9, color: colorMarcador, fillColor: colorMarcador,
                    fillOpacity: provisional ? 0.35 : 0.9, dashArray: provisional ? "4 3" : "",
                }).addTo(mapa);
            };

            const marcar = async (latitud: number, longitud: number) => {
                const solicitud = ++solicitudSeleccionRef.current;
                seleccionAbortRef.current?.abort();
                const controlador = new AbortController();
                seleccionAbortRef.current = controlador;
                solicitudBusquedaRef.current += 1;
                busquedaAbortRef.current?.abort();
                setBuscando(false);
                setResultados([]);
                setErrorBusqueda("");
                setSeleccion(null);
                setErrorSeleccion("");
                if (!coordenadasValidas(latitud, longitud)) {
                    marcadorRef.current?.remove();
                    marcadorRef.current = null;
                    setIdentificando(false);
                    setErrorSeleccion("Seleccioná un punto válido dentro de Uruguay.");
                    return;
                }
                ponerMarcador(latitud, longitud, true);
                setIdentificando(true);
                try {
                    const respuesta = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitud)}&lon=${encodeURIComponent(longitud)}&zoom=18&addressdetails=1`, {
                        headers: { "Accept-Language": "es" }, signal: controlador.signal,
                    });
                    if (!respuesta.ok) throw new Error();
                    const datos = await respuesta.json() as { display_name?: string; address?: { country_code?: string; state?: string; county?: string; city?: string; town?: string; village?: string; suburb?: string; neighbourhood?: string; road?: string } };
                    if (!activo || controlador.signal.aborted || solicitud !== solicitudSeleccionRef.current) return;
                    if (datos.address?.country_code?.toLowerCase() !== "uy") throw new Error("La ubicación debe estar dentro de Uruguay.");
                    const departamento = normalizarDepartamento(datos.address?.state) ?? normalizarDepartamento(datos.address?.county);
                    if (!departamento) throw new Error("No pudimos identificar el departamento. Seleccioná nuevamente el punto en el mapa.");
                    const nombres = [datos.address?.road, datos.address?.neighbourhood, datos.address?.suburb,
                        datos.address?.village, datos.address?.town, datos.address?.city,
                        typeof datos.display_name === "string" ? datos.display_name.split(",")[0] : null];
                    const sugerido = nombres.find((valor) => typeof valor === "string" && valor.trim())?.trim() || departamento;
                    setSeleccion({ latitud, longitud, departamento, nombreLugar: sugerido });
                    if (!nombreEditadoRef.current) setNombre(sugerido.slice(0, 200));
                    marcadorRef.current?.setStyle({ fillOpacity: 0.9, dashArray: "" });
                } catch (razon) {
                    if (!activo || controlador.signal.aborted || solicitud !== solicitudSeleccionRef.current) return;
                    setSeleccion(null);
                    marcadorRef.current?.remove();
                    marcadorRef.current = null;
                    const mensaje = razon instanceof Error ? razon.message : "";
                    setErrorSeleccion(mensaje === "La ubicación debe estar dentro de Uruguay." || mensaje === "No pudimos identificar el departamento. Seleccioná nuevamente el punto en el mapa."
                        ? mensaje : "No pudimos identificar la ubicación. Revisá tu conexión e intentá nuevamente.");
                } finally {
                    if (activo && !controlador.signal.aborted && solicitud === solicitudSeleccionRef.current) setIdentificando(false);
                }
            };
            seleccionarCoordenadasRef.current = marcar;
            setMapaListo(true);
            if (inicial) {
                if (inicial.departamento) ponerMarcador(inicial.latitud, inicial.longitud, false);
                else void marcar(inicial.latitud, inicial.longitud);
            }
            mapa.on("click", (evento) => { void marcar(evento.latlng.lat, evento.latlng.lng); });
        }).catch(() => {
            if (!activo) return;
            setMapaListo(false);
            setErrorMapa("No se pudo cargar el mapa. Cerralo e intentá nuevamente.");
        });

        return () => {
            activo = false;
            solicitudBusquedaRef.current += 1;
            solicitudSeleccionRef.current += 1;
            busquedaAbortRef.current?.abort();
            seleccionAbortRef.current?.abort();
            if (temporizadorTamano !== undefined) clearTimeout(temporizadorTamano);
            observador?.disconnect();
            marcadorRef.current = null;
            seleccionarCoordenadasRef.current = null;
            mapaInstanciaRef.current?.remove();
            mapaInstanciaRef.current = null;
        };
    }, [abierto, elementoMapa, latitudInicial, longitudInicial, departamentoInicial, nombreLugarInicial]);

    function cerrar() {
        solicitudBusquedaRef.current += 1;
        solicitudSeleccionRef.current += 1;
        busquedaAbortRef.current?.abort();
        seleccionAbortRef.current?.abort();
        alCerrar();
    }

    function cambiarBusqueda(valor: string) {
        solicitudBusquedaRef.current += 1;
        busquedaAbortRef.current?.abort();
        setBuscando(false);
        setBusqueda(valor);
        setResultados([]);
        setErrorBusqueda("");
    }

    async function buscarLugar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        evento.stopPropagation();
        const consulta = busqueda.trim();
        if (!consulta || !mapaListo) return;
        const solicitud = ++solicitudBusquedaRef.current;
        busquedaAbortRef.current?.abort();
        const controlador = new AbortController();
        busquedaAbortRef.current = controlador;
        setBuscando(true);
        setResultados([]);
        setErrorBusqueda("");
        try {
            const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=uy&q=${encodeURIComponent(consulta)}`, {
                headers: { "Accept-Language": "es" }, signal: controlador.signal,
            });
            if (!respuesta.ok) throw new Error();
            const datos: unknown = await respuesta.json();
            if (controlador.signal.aborted || solicitud !== solicitudBusquedaRef.current) return;
            if (!Array.isArray(datos)) throw new Error();
            const encontrados = datos.filter(resultadoValido).slice(0, 5);
            setResultados(encontrados);
            if (encontrados.length === 0) setErrorBusqueda("No se encontraron lugares para esa búsqueda. Probá otra dirección o marcá el punto en el mapa.");
        } catch {
            if (controlador.signal.aborted || solicitud !== solicitudBusquedaRef.current) return;
            setResultados([]);
            setErrorBusqueda("No pudimos buscar el lugar. Revisá tu conexión e intentá nuevamente.");
        } finally {
            if (!controlador.signal.aborted && solicitud === solicitudBusquedaRef.current) setBuscando(false);
        }
    }

    function elegirResultado(resultado: ResultadoBusqueda) {
        const latitud = Number(resultado.lat);
        const longitud = Number(resultado.lon);
        if (!coordenadasValidas(latitud, longitud) || !seleccionarCoordenadasRef.current) return;
        setBusqueda(resultado.display_name);
        setResultados([]);
        mapaInstanciaRef.current?.setView([latitud, longitud], 16);
        void seleccionarCoordenadasRef.current(latitud, longitud);
    }

    const nombreValido = nombre.trim().length > 0 && nombre.trim().length <= 200;
    const puedeConfirmar = mapaListo && !identificando && !errorSeleccion && !errorMapa && Boolean(seleccion?.departamento) && nombreValido;
    function confirmar() {
        if (!puedeConfirmar || !seleccion) return;
        alConfirmar({ ...seleccion, nombreLugar: nombre.trim() });
    }

    if (!abierto) return null;
    return <Dialog open onClose={cerrar} fullScreen={esMobile} fullWidth maxWidth="md" aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-ayuda`}
        slotProps={{ paper: { className: styles.modal }, transition: { onEntered: () => mapaInstanciaRef.current?.invalidateSize() } }}>
        <header className={styles.encabezado}>
            <h2 id={`${id}-titulo`}>{modo === "editar" ? "Editar punto de retiro" : "Agregar punto de retiro"}</h2>
            <IconButton type="button" onClick={cerrar} aria-label="Cerrar mapa" className={styles.cerrar}><CloseIcon /></IconButton>
        </header>
        <div className={styles.contenido}>
            <p className={styles.ayuda} id={`${id}-ayuda`}>Buscá una dirección o tocá el mapa para elegir el lugar de retiro. Podés ajustar el punto antes de confirmar.</p>
            <form className={styles.buscador} onSubmit={buscarLugar} role="search" aria-label="Buscar punto de retiro">
                <div className={styles.controlesBusqueda}>
                    <TextField id={`${id}-busqueda`} label="Buscar dirección o lugar" type="search" size="small" fullWidth className={styles.entradaBusqueda}
                        value={busqueda} onChange={(evento) => cambiarBusqueda(evento.target.value)} placeholder="Ej.: Ruta 5, Canelones" disabled={!mapaListo}
                        slotProps={{ htmlInput: { maxLength: 200 } }} />
                    <Button type="submit" variant="contained" color="secondary" startIcon={<SearchIcon />} disabled={buscando || !busqueda.trim() || !mapaListo}>{buscando ? "Buscando..." : "Buscar"}</Button>
                </div>
                {resultados.length > 0 && <ul className={styles.resultados} aria-label="Resultados de búsqueda">
                    {resultados.map((resultado) => <li key={resultado.place_id}><button type="button" onClick={() => elegirResultado(resultado)}><LocationOnOutlinedIcon aria-hidden="true" /><span>{resultado.display_name}</span></button></li>)}
                </ul>}
                {errorBusqueda && <p className={styles.error} role="alert">{errorBusqueda}</p>}
            </form>
            <div className={styles.mapaContenedor} aria-busy={!mapaListo && !errorMapa}>
                <div className={styles.mapa} ref={setElementoMapa} aria-label="Mapa para elegir el punto de retiro" />
                {!mapaListo && <div className={styles.estadoMapa}>
                    {errorMapa ? <p className={styles.error} role="alert">{errorMapa}</p> : <><CircularProgress size={28} color="secondary" /><span>Cargando mapa...</span></>}
                </div>}
            </div>
            <div className={styles.resumen} role="status" aria-live="polite">
                {identificando ? <CircularProgress size={20} color="secondary" /> : <LocationOnOutlinedIcon aria-hidden="true" />}
                <div>
                    <strong>{identificando ? "Identificando el departamento..." : seleccion ? `Departamento: ${seleccion.departamento}` : "Falta elegir el punto de retiro"}</strong>
                    <span>{seleccion ? "El punto marcado se usará para mostrar la ubicación." : "El departamento se completa al seleccionar un punto dentro de Uruguay."}</span>
                </div>
            </div>
            {errorSeleccion && <p className={styles.error} role="alert">{errorSeleccion}</p>}
            <TextField id={`${id}-nombre`} label="Nombre del punto de retiro" value={nombre} required fullWidth size="small"
                onChange={(evento) => { nombreEditadoRef.current = true; setNombre(evento.target.value); }} onBlur={() => setNombreRevisado(true)}
                error={nombreRevisado && !nombreValido} helperText={nombreRevisado && !nombreValido ? "Escribí un nombre de hasta 200 caracteres." : undefined}
                slotProps={{ htmlInput: { maxLength: 200 } }} />
        </div>
        <footer className={styles.pie}>
            <Button type="button" variant="outlined" color="secondary" onClick={cerrar}>Cancelar</Button>
            <Button type="button" variant="contained" color="secondary" onClick={confirmar} disabled={!puedeConfirmar}>{modo === "editar" ? "Guardar cambios" : "Agregar punto"}</Button>
        </footer>
    </Dialog>;
}
