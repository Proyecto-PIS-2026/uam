"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import LeafletLocationPicker, { type UbicacionSeleccionada } from "./LeafletLocationPicker";
import estilosFormulario from "../operadores/componentes/DrawerEditarPublicacion.module.css";
import styles from "./UbicacionesEdicionProductor.module.css";

export type UbicacionEdicionProductor = { clave: number; nombreUbicacion: string; urlMaps: string };

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
        return { latitud, longitud, departamento: "", nombreLugar: ubicacion.nombreUbicacion || null };
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
        cambiarUbicacion(mapa.clave, {
            nombreUbicacion: coordenadas.nombreLugar || coordenadas.departamento,
            urlMaps: `https://www.google.com/maps?q=${coordenadas.latitud},${coordenadas.longitud}`,
        });
        cerrarMapa();
    }

    return <section ref={seccionRef} className={styles.seccion} aria-label="Ubicaciones de retiro">
        <button type="button" className={estilosFormulario.guardar} disabled={deshabilitado} aria-expanded={expandido} aria-controls={listaId} onClick={() => setExpandido(!expandido)}>
            {ubicaciones.length > 0 ? "Cambiar ubicación" : "Seleccionar ubicación de retiro"}
        </button>
        {ubicaciones.length > 0 && <p className={styles.resumen}>{ubicaciones.map((ubicacion, indice) => ubicacion.nombreUbicacion.trim() || `Punto de retiro ${indice + 1}`).join(" · ")}</p>}
        {expandido && <div className={styles.lista} id={listaId}>
            {ubicaciones.map((ubicacion, indice) => <fieldset className={styles.ubicacion} key={ubicacion.clave} disabled={deshabilitado}>
                <legend className={estilosFormulario.etiqueta}>Punto de retiro {indice + 1}</legend>
                <label className={estilosFormulario.campo}>
                    <span className={estilosFormulario.etiqueta}>Nombre del punto de retiro {indice + 1}</span>
                    <input className={estilosFormulario.entrada} value={ubicacion.nombreUbicacion} maxLength={200} required onChange={(evento) => cambiarUbicacion(ubicacion.clave, { nombreUbicacion: evento.target.value })} />
                </label>
                <label className={estilosFormulario.campo}>
                    <span className={estilosFormulario.etiqueta}>Enlace de Google Maps {indice + 1}</span>
                    <input className={estilosFormulario.entrada} type="url" value={ubicacion.urlMaps} maxLength={2048} placeholder="https://maps.app.goo.gl/..." required onChange={(evento) => cambiarUbicacion(ubicacion.clave, { urlMaps: evento.target.value })} />
                </label>
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
