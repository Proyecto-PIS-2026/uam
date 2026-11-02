"use client";

import { useId, useRef, useState } from "react";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import { normalizarDepartamento } from "@/compartido/departamentos-uruguay";
import LeafletLocationPicker, { type UbicacionSeleccionada } from "./LeafletLocationPicker";
import styles from "./UbicacionesEdicionProductor.module.css";

export type UbicacionEdicionProductor = { clave: number; nombreUbicacion: string; urlMaps: string; departamento?: string | null };

type Props = {
    ubicaciones: UbicacionEdicionProductor[];
    deshabilitado: boolean;
    alCambiar: (ubicaciones: UbicacionEdicionProductor[]) => void;
};

type EdicionMapa = {
    modo: "agregar" | "editar";
    clave: number;
    coordenadas: UbicacionSeleccionada | null;
    nombreInicial: string;
};

const MAXIMO_PUNTOS = 20;

function coordenadasDe(ubicacion: UbicacionEdicionProductor): UbicacionSeleccionada | null {
    try {
        const url = new URL(ubicacion.urlMaps);
        const consulta = url.searchParams.get("q") ?? url.searchParams.get("query");
        if (!consulta || !/^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(consulta)) return null;
        const [latitud, longitud] = consulta.split(",").map(Number);
        if (!Number.isFinite(latitud) || !Number.isFinite(longitud) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) return null;
        return { latitud, longitud, departamento: normalizarDepartamento(ubicacion.departamento) ?? "", nombreLugar: ubicacion.nombreUbicacion || null };
    } catch {
        return null;
    }
}

export default function UbicacionesEdicionProductor({ ubicaciones, deshabilitado, alCambiar }: Props) {
    const id = useId();
    const agregarRef = useRef<HTMLButtonElement>(null);
    const ultimaClaveRef = useRef(0);
    const [mapa, setMapa] = useState<EdicionMapa | null>(null);

    function agregarUbicacion() {
        if (deshabilitado || ubicaciones.length >= MAXIMO_PUNTOS) return;
        const clave = Math.max(ultimaClaveRef.current, 0, ...ubicaciones.map((ubicacion) => ubicacion.clave)) + 1;
        ultimaClaveRef.current = clave;
        setMapa({ modo: "agregar", clave, coordenadas: null, nombreInicial: "" });
    }

    function editarUbicacion(ubicacion: UbicacionEdicionProductor) {
        if (deshabilitado) return;
        setMapa({ modo: "editar", clave: ubicacion.clave, coordenadas: coordenadasDe(ubicacion), nombreInicial: ubicacion.nombreUbicacion });
    }

    function quitarUbicacion(clave: number) {
        if (deshabilitado) return;
        alCambiar(ubicaciones.filter((ubicacion) => ubicacion.clave !== clave));
        agregarRef.current?.focus();
    }

    function confirmarMapa(coordenadas: UbicacionSeleccionada) {
        if (!mapa || deshabilitado) return;
        const departamento = normalizarDepartamento(coordenadas.departamento);
        const nombreUbicacion = coordenadas.nombreLugar?.trim();
        if (!departamento || !nombreUbicacion || nombreUbicacion.length > 200
            || !Number.isFinite(coordenadas.latitud) || !Number.isFinite(coordenadas.longitud)
            || Math.abs(coordenadas.latitud) > 90 || Math.abs(coordenadas.longitud) > 180) return;
        const ubicacion = {
            clave: mapa.clave,
            nombreUbicacion,
            urlMaps: `https://www.google.com/maps?q=${coordenadas.latitud},${coordenadas.longitud}`,
            departamento,
        };
        if (mapa.modo === "agregar") {
            if (ubicaciones.length >= MAXIMO_PUNTOS) return;
            alCambiar([...ubicaciones, ubicacion]);
        } else {
            if (!ubicaciones.some((actual) => actual.clave === mapa.clave)) return;
            alCambiar(ubicaciones.map((actual) => actual.clave === mapa.clave ? ubicacion : actual));
        }
        setMapa(null);
    }

    return (
        <section className={styles.seccion} aria-labelledby={`${id}-titulo`}>
            <div className={styles.encabezado}>
                <h3 className={styles.titulo} id={`${id}-titulo`}>Puntos de retiro</h3>
                <span className={styles.opcional}>Opcional</span>
            </div>
            <p className={styles.ayuda}>Agregá los lugares donde se puede retirar el producto.</p>
            {ubicaciones.length === 0 ? (
                <EstadoVacio
                    titulo="Sin puntos de retiro"
                    descripcion="Podés agregar uno o continuar sin indicar una ubicación."
                    icono={<LocationOnOutlinedIcon />}
                    compacto
                    anunciar={false}
                />
            ) : (
                <ul className={styles.lista} aria-label="Puntos de retiro seleccionados">
                    {ubicaciones.map((ubicacion, indice) => (
                        <li className={styles.tarjeta} key={ubicacion.clave}>
                            <div className={styles.resumen}>
                                <span className={styles.icono} aria-hidden="true"><LocationOnOutlinedIcon fontSize="small" /></span>
                                <div className={styles.informacion}>
                                    <span className={styles.nombre}>{ubicacion.nombreUbicacion.trim() || `Punto de retiro ${indice + 1}`}</span>
                                    <span className={styles.departamento}>Departamento: {normalizarDepartamento(ubicacion.departamento) || "Sin identificar"}</span>
                                    {!normalizarDepartamento(ubicacion.departamento) && <span className={styles.ayuda}>Editá este punto para completar su departamento.</span>}
                                </div>
                            </div>
                            <div className={styles.acciones}>
                                <button type="button" className={`boton-secundario ${styles.accion}`} onClick={() => editarUbicacion(ubicacion)} disabled={deshabilitado} aria-label={`Editar punto de retiro ${indice + 1}`}>
                                    <EditOutlinedIcon aria-hidden="true" />Editar
                                </button>
                                <button type="button" className={`boton-secundario ${styles.accion} ${styles.quitar}`} onClick={() => quitarUbicacion(ubicacion.clave)} disabled={deshabilitado} aria-label={`Quitar punto de retiro ${indice + 1}`}>
                                    <DeleteOutlinedIcon aria-hidden="true" />Quitar
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <button ref={agregarRef} type="button" className={`boton-secundario ${styles.agregar}`} disabled={deshabilitado || ubicaciones.length >= MAXIMO_PUNTOS} onClick={agregarUbicacion}>
                <AddLocationAltOutlinedIcon aria-hidden="true" />Agregar punto de retiro
            </button>
            {ubicaciones.length >= MAXIMO_PUNTOS && <p className={styles.ayuda}>Alcanzaste el máximo de {MAXIMO_PUNTOS} puntos de retiro.</p>}
            <p className={styles.ayuda}>Los puntos se guardan junto con la publicación.</p>
            {mapa && !deshabilitado && <LeafletLocationPicker
                abierto
                modo={mapa.modo}
                nombreInicial={mapa.nombreInicial}
                coordenadas={mapa.coordenadas}
                alCerrar={() => setMapa(null)}
                alConfirmar={confirmarMapa}
            />}
        </section>
    );
}
