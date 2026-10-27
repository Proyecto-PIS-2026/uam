"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import LeafletLocationPicker, { type UbicacionSeleccionada } from "./LeafletLocationPicker";
import { normalizarDepartamento } from "@/compartido/departamentos-uruguay";
import estilosFormulario from "../operadores/componentes/DrawerEditarPublicacion.module.css";
import styles from "./UbicacionesEdicionProductor.module.css";

export type UbicacionEdicionProductor = { clave: number; nombreUbicacion: string; urlMaps: string; departamento?: string | null };

type Props = {
    ubicaciones: UbicacionEdicionProductor[];
    deshabilitado: boolean;
    alCambiar: (ubicaciones: UbicacionEdicionProductor[]) => void;
};

function coordenadasDe(ubicacion: UbicacionEdicionProductor): UbicacionSeleccionada | null {
    try {
        const consulta = new URL(ubicacion.urlMaps).searchParams.get("q");
        if (!consulta || !/^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(consulta)) return null;
        const [latitud, longitud] = consulta.split(",").map(Number);
        if (Math.abs(latitud) > 90 || Math.abs(longitud) > 180) return null;
        return { latitud, longitud, departamento: normalizarDepartamento(ubicacion.departamento) ?? "", nombreLugar: ubicacion.nombreUbicacion || null };
    } catch {
        return null;
    }
}

export default function UbicacionesEdicionProductor({ ubicaciones, deshabilitado, alCambiar }: Props) {
    const listaId = useId();
    const seccionRef = useRef<HTMLElement>(null);
    const ultimaClaveRef = useRef(0);
    const [expandido, setExpandido] = useState(false);
    const [mapa, setMapa] = useState<{ clave: number; coordenadas: UbicacionSeleccionada | null; contenedor: HTMLElement; botonOrigen: HTMLButtonElement } | null>(null);

    function agregarUbicacion() {
        if (deshabilitado || ubicaciones.length >= 20) return;
        const clave = Math.max(ultimaClaveRef.current, 0, ...ubicaciones.map((ubicacion) => ubicacion.clave)) + 1;
        ultimaClaveRef.current = clave;
        alCambiar([...ubicaciones, { clave, nombreUbicacion: "", urlMaps: "" }]);
    }

    function cambiarUbicacion(clave: number, cambios: Partial<UbicacionEdicionProductor>) {
        if (!deshabilitado) alCambiar(ubicaciones.map((ubicacion) => ubicacion.clave === clave ? { ...ubicacion, ...cambios } : ubicacion));
    }

    function abrirMapa(ubicacion: UbicacionEdicionProductor, botonOrigen: HTMLButtonElement) {
        if (deshabilitado) return;
        // El buscador tiene su propio formulario. Mantenerlo fuera del formulario de edición
        // evita anidarlos y conserva el foco dentro del Drawer de Material UI.
        const contenedor = seccionRef.current?.closest("form")?.parentElement ?? document.body;
        setMapa({ clave: ubicacion.clave, coordenadas: coordenadasDe(ubicacion), contenedor, botonOrigen });
    }

    function cerrarMapa() {
        mapa?.botonOrigen.focus();
        setMapa(null);
    }

    function confirmarMapa(coordenadas: UbicacionSeleccionada) {
        if (!mapa || deshabilitado) return;
        const departamento = normalizarDepartamento(coordenadas.departamento);
        if (!departamento) return;
        cambiarUbicacion(mapa.clave, {
            nombreUbicacion: coordenadas.nombreLugar || coordenadas.departamento,
            urlMaps: `https://www.google.com/maps?q=${coordenadas.latitud},${coordenadas.longitud}`,
            departamento,
        });
        cerrarMapa();
    }

    return <section ref={seccionRef} className={styles.seccion} aria-label="Ubicaciones de retiro">
        <button type="button" className={estilosFormulario.guardar} disabled={deshabilitado} aria-expanded={expandido} aria-controls={expandido || ubicaciones.length > 0 ? listaId : undefined} onClick={() => setExpandido(!expandido)}>
            {ubicaciones.length > 0 ? "Cambiar ubicación" : "Seleccionar ubicación de retiro"}
        </button>
        {!expandido && ubicaciones.length > 0 && <ul className={styles.resumenUbicaciones} id={listaId} aria-label="Puntos de retiro seleccionados">
            {ubicaciones.map((ubicacion, indice) => <li className={styles.tarjetaResumen} key={ubicacion.clave}>
                <span className={styles.iconoResumen} aria-hidden="true"><LocationOnOutlinedIcon fontSize="small" /></span>
                <div className={styles.informacionResumen}>
                    <span className={styles.nombreResumen}>{ubicacion.nombreUbicacion.trim() || `Punto de retiro ${indice + 1}`}</span>
                    <span className={styles.departamentoResumen}>Departamento: {normalizarDepartamento(ubicacion.departamento) || "-"}</span>
                </div>
            </li>)}
        </ul>}
        {expandido && <div className={styles.lista} id={listaId}>
            {ubicaciones.map((ubicacion, indice) => <fieldset className={styles.ubicacion} key={ubicacion.clave} disabled={deshabilitado}>
                <legend className={estilosFormulario.etiqueta}>Punto de retiro {indice + 1}</legend>
                <label className={estilosFormulario.campo}>
                    <span className={estilosFormulario.etiqueta}>Nombre del punto de retiro {indice + 1}</span>
                    <input className={estilosFormulario.entrada} value={ubicacion.nombreUbicacion} maxLength={200} required onChange={(evento) => cambiarUbicacion(ubicacion.clave, { nombreUbicacion: evento.target.value })} />
                </label>
                <p className={styles.resumen}>
                    {normalizarDepartamento(ubicacion.departamento)
                        ? <>Departamento: <strong>{normalizarDepartamento(ubicacion.departamento)}</strong></>
                        : ubicacion.urlMaps
                            ? "Volvé a seleccionar este punto en el mapa para identificar su departamento."
                            : "Seleccioná el punto de retiro en el mapa."}
                </p>
                <div className={styles.acciones}>
                    <button type="button" className={estilosFormulario.cancelar} onClick={(evento) => abrirMapa(ubicacion, evento.currentTarget)} aria-label={`Seleccionar en mapa punto de retiro ${indice + 1}`}>Seleccionar en mapa</button>
                    <button type="button" className={`${estilosFormulario.cancelar} ${estilosFormulario.eliminar}`} aria-label={`Eliminar punto de retiro ${indice + 1}`} onClick={() => !deshabilitado && alCambiar(ubicaciones.filter((actual) => actual.clave !== ubicacion.clave))}>Eliminar punto</button>
                </div>
            </fieldset>)}
            <button type="button" className={estilosFormulario.cancelar} disabled={deshabilitado || ubicaciones.length >= 20} onClick={agregarUbicacion}>Agregar punto de retiro</button>
        </div>}
        {mapa && !deshabilitado && createPortal(<div onSubmit={(evento) => evento.stopPropagation()} onKeyDown={(evento) => {
            if (evento.key !== "Escape") return;
            evento.preventDefault();
            evento.stopPropagation();
            cerrarMapa();
        }}>
            <LeafletLocationPicker abierto coordenadas={mapa.coordenadas} alCerrar={cerrarMapa} alConfirmar={confirmarMapa} />
        </div>, mapa.contenedor)}
    </section>;
}
