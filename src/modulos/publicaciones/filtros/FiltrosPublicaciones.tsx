"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import { MenuItem, TextField } from "@mui/material";
import BotonOrdenar from "@/compartido/componentes/BotonOrdenar";
import AvisoErrorToast from "@/compartido/componentes/AvisoErrorToast";
import BotonDesplegable from "@/compartido/componentes/BotonDesplegable";
import { compararEspeciesPorPrioridad } from "../../../compartido/prioridad-especies";
import { esEntradaPrecioPublicacion, MAXIMO_DIGITOS_PRECIO } from "@/modulos/publicaciones/precio-publicacion";
import { compararPorPonderacionYFecha } from "../ponderacion-publicacion";
import type { PublicacionListado } from "../../consulta-mercado/acciones/PublicacionesOperador";
import styles from "./FiltrosPublicaciones.module.css";

import type { FiltrosConsulta, OpcionProducto, OrdenConsulta } from "../../consulta-mercado/acciones/filtros-consulta";

type PublicacionFiltrable = {
    especie: string;
    variedad: string;
    envase: string;
    kilos: string;
    categoria: string;
    calibre: string;
    codigoCalibre: string;
    precio: number | null;
    fecha: string;
    tipoPublicacion?: "OPERADOR" | "PRODUCTOR";
};

type FiltrosPublicacionesProps<T extends PublicacionFiltrable> = {
    publicaciones: T[];
    opcionesRemotas?: OpcionProducto[];
    navesDisponibles?: string[];
    totalRemoto?: number;
    alConsultar?: (consulta: FiltrosConsulta) => void;
    especieFiltro: string;
    obtenerNombreFantasia: (publicacion: T) => string;
    alFiltrar?: (publicaciones: T[]) => void;
    alLimpiar?: () => void;
    alCambiarEspecie?: (especie: string) => void;
    ordenInicial?: OrdenPublicaciones;
    alCambiarOrden?: (orden: OrdenPublicaciones) => void;
    ordenamientoHabilitado?: boolean;
};

const propiedadesMenuSelect = { select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } } as const;

function normalizarTexto(texto: string) {
    return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const compararOpciones = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" })

const compararPrecios = (a: PublicacionFiltrable, b: PublicacionFiltrable, ascendente: boolean) => {
    if (a.precio == null && b.precio == null) return 0;
    if (a.precio == null) return 1;
    if (b.precio == null) return -1;

    return ascendente ? a.precio - b.precio : b.precio - a.precio;
};

export type OrdenPublicaciones = OrdenConsulta;

export function compararPublicacionesAlfabeticamente(a: Pick<PublicacionFiltrable, "especie" | "variedad">, b: Pick<PublicacionFiltrable, "especie" | "variedad">) {
    const especie = compararOpciones(a.especie, b.especie);
    return especie !== 0 ? especie : compararOpciones(a.variedad, b.variedad);
}

export function compararPublicacionesPorPrioridad(a: Pick<PublicacionFiltrable, "especie" | "variedad">, b: Pick<PublicacionFiltrable, "especie" | "variedad">) {
    const especie = compararEspeciesPorPrioridad(a.especie, b.especie);
    return especie !== 0 ? especie : compararOpciones(a.variedad, b.variedad);
}

export function compararPublicacionesOperador(a: PublicacionListado, b: PublicacionListado, orden: OrdenConsulta): number {
    let comparacion = 0;
    switch (orden) {
        case "precioAsc":
            comparacion = compararPrecios(a, b, true);
            break;
        case "precioDesc":
            comparacion = compararPrecios(a, b, false);
            break;
        case "alfabeticoAsc":
            comparacion = compararOpciones(a.especie, b.especie);
            break;
        case "alfabeticoDesc":
            comparacion = compararOpciones(b.especie, a.especie);
            break;
        case "prioridad":
            comparacion = compararEspeciesPorPrioridad(a.especie, b.especie);
            break;
        case "fechaDesc":
            comparacion = new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
            break;
    }
    return comparacion || compararPorPonderacionYFecha(a, b);
}

export default function FiltrosPublicaciones<T extends PublicacionFiltrable>({publicaciones, especieFiltro, obtenerNombreFantasia, alFiltrar, alLimpiar, alCambiarEspecie, ordenInicial = "ninguno", alCambiarOrden, opcionesRemotas, navesDisponibles, totalRemoto, alConsultar, ordenamientoHabilitado = true}: FiltrosPublicacionesProps<T>) {
    const opciones: OpcionProducto[] = opcionesRemotas ?? publicaciones;
    const mostrarNave = navesDisponibles !== undefined;
    const [busqueda, setBusqueda] = useState("");
    const [precioMinimo, setPrecioMinimo] = useState("");
    const [precioMaximo, setPrecioMaximo] = useState("");
    const [especie, setEspecie] = useState(especieFiltro === "" ? "Todas" : especieFiltro);
    const [variedad, setVariedad] = useState(() => {
        const variedadesIniciales = new Set(opciones.filter((publicacion) => publicacion.especie === especieFiltro).map((publicacion) => publicacion.variedad));
        return especieFiltro !== "" && variedadesIniciales.size === 1 && variedadesIniciales.has("-") ? "-" : "Todas";
    });
    const [envase, setEnvase] = useState("Todas");
    const [kilos, setKilos] = useState("Todas");
    const [categoria, setCategoria] = useState("Todas");
    const [calibre, setCalibre] = useState("Todas");
    const [nave, setNave] = useState("Todas");

    const [ultimaFaceta, setUltimaFaceta] = useState<"categoria" | "calibre" | null>(null);

    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const idFiltrosExtendidos = useId();

    const [ordenElegido, setOrden] = useState<OrdenPublicaciones | "predeterminado">("predeterminado");
    const orden = ordenamientoHabilitado && ordenElegido !== "predeterminado" ? ordenElegido : ordenInicial;

    const [publicacionesAnteriores, setPublicacionesAnteriores] = useState(opciones);
    const especieNotificada = useRef(especie);

    // Reconciliar antes de filtrar evita publicar resultados con selecciones que ya no existen.
    if (publicacionesAnteriores !== opciones) {
        setPublicacionesAnteriores(opciones);
        const nuevaEspecie = especie === "Todas" || opciones.some((publicacion) => publicacion.especie === especie) ? especie : "Todas";
        let publicacionesBase = nuevaEspecie === "Todas" ? opciones : opciones.filter((publicacion) => publicacion.especie === nuevaEspecie);
        const variedadesDisponibles = new Set(publicacionesBase.map((publicacion) => publicacion.variedad));
        let nuevaVariedad = nuevaEspecie !== "Todas" && variedadesDisponibles.has(variedad) ? variedad : "Todas";
        if (nuevaEspecie !== "Todas" && variedadesDisponibles.size === 1 && variedadesDisponibles.has("-")) nuevaVariedad = "-";
        if (nuevaVariedad !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) => publicacion.variedad === nuevaVariedad);

        const nuevoEnvase = opciones.some((publicacion) => publicacion.envase === envase) ? envase : "Todas";
        const nuevosKilos = opciones.some((publicacion) => publicacion.kilos === kilos) ? kilos : "Todas";
        if (nuevoEnvase !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) => publicacion.envase === nuevoEnvase);
        if (nuevosKilos !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) => publicacion.kilos === nuevosKilos);

        let nuevaCategoria = publicacionesBase.some((publicacion) => publicacion.categoria === categoria) ? categoria : "Todas";
        let nuevoCalibre = publicacionesBase.some((publicacion) => publicacion.calibre === calibre) ? calibre : "Todas";
        if (nuevaCategoria !== "Todas" && nuevoCalibre !== "Todas"
            && !publicacionesBase.some((publicacion) => publicacion.categoria === nuevaCategoria && publicacion.calibre === nuevoCalibre)) {
            if (ultimaFaceta === "calibre") nuevaCategoria = "Todas";
            else nuevoCalibre = "Todas";
        }

        if (nuevaEspecie !== especie) setEspecie(nuevaEspecie);
        if (nuevaVariedad !== variedad) setVariedad(nuevaVariedad);
        if (nuevoEnvase !== envase) setEnvase(nuevoEnvase);
        if (nuevosKilos !== kilos) setKilos(nuevosKilos);
        if (nuevaCategoria !== categoria) setCategoria(nuevaCategoria);
        if (nuevoCalibre !== calibre) setCalibre(nuevoCalibre);
    }

    useEffect(() => {
        if (especieNotificada.current !== especie) {
            especieNotificada.current = especie;
            alCambiarEspecie?.(especie);
        }
    }, [especie, alCambiarEspecie]);

    const especies = useMemo(() => {
        const nombres = [...new Set(opciones.map((publicacion) => publicacion.especie))];
        return nombres.sort(compararEspeciesPorPrioridad);
    }, [opciones]);

    const naves = useMemo(() => {
        const disponibles = new Set(navesDisponibles ?? []);
        if (nave !== "Todas") disponibles.add(nave);
        return [...disponibles].sort(compararOpciones);
    }, [navesDisponibles, nave]);

    const variedades = useMemo(() => {
        let publicacionesBase = opciones;
        if (especie !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.especie === especie);

        return [...new Set(publicacionesBase.map((publicacion) => publicacion.variedad).filter(Boolean))].sort(compararOpciones);
    }, [opciones, especie]);

    const publicacionesSegunJerarquia = useMemo(() => {
        let publicacionesBase = opciones;
        if (especie !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.especie === especie);
        if (variedad !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.variedad === variedad);
        if (envase !== "Todas")  publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.envase === envase);
        if (kilos !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) => publicacion.kilos === kilos);

        return publicacionesBase;
    }, [opciones, especie, variedad, envase, kilos]);

    // Envase y kilos se pueden consultar sin seleccionar especie ni variedad.
    const envases = useMemo(() => [...new Set(opciones.map((publicacion) => publicacion.envase).filter(Boolean))].sort(compararOpciones), [opciones]);
    const opcionesKilos = useMemo(() => [...new Set(opciones.map((publicacion) => publicacion.kilos).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "es", { numeric: true })), [opciones]);

    const categorias = useMemo(() => {
        let publicacionesBase = publicacionesSegunJerarquia;

        if (calibre !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.calibre === calibre);

        return [...new Set(publicacionesBase.map((publicacion) => publicacion.categoria).filter(Boolean))].sort(compararOpciones);
    }, [publicacionesSegunJerarquia, calibre]);

    const calibres = useMemo(() => {
        let publicacionesBase = publicacionesSegunJerarquia;
        if (categoria !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.categoria === categoria);

        return [...new Set(publicacionesBase.map((publicacion) => publicacion.calibre).filter(Boolean))].sort(compararOpciones);
    }, [publicacionesSegunJerarquia, categoria]);

    const obtenerPublicacionesJerarquia = (nuevaEspecie: string, nuevaVariedad: string, nuevoEnvase: string, nuevosKilos: string) => {
        let publicacionesBase = opciones;
        if (nuevaEspecie !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.especie === nuevaEspecie);
        if (nuevaVariedad !== "Todas")  publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.variedad === nuevaVariedad);
        if (nuevoEnvase !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.envase === nuevoEnvase);
        if (nuevosKilos !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) => publicacion.kilos === nuevosKilos);

        return publicacionesBase;
    };

    const ajustarFiltrosCategoriaCalibre = (publicacionesBase: OpcionProducto[]) => {
        const categoriaValida = categoria === "Todas" || publicacionesBase.some((publicacion) =>
            publicacion.categoria === categoria);
        const calibreValido = calibre === "Todas" || publicacionesBase.some((publicacion) =>
            publicacion.calibre === calibre);
        if (!categoriaValida) setCategoria("Todas");
        if (!calibreValido) setCalibre("Todas");
        if (categoriaValida && calibreValido && categoria !== "Todas" && calibre !== "Todas"
        ) {
            const combinacionValida = publicacionesBase.some((publicacion) =>
                publicacion.categoria === categoria && publicacion.calibre === calibre);
            if (!combinacionValida) {
                if (ultimaFaceta === "categoria") setCalibre("Todas");
                if (ultimaFaceta === "calibre") setCategoria("Todas");
            }
        }
    };

    const publicacionesFiltradas = useMemo(() => {
        if (opcionesRemotas) return [];
        const textoBusqueda = normalizarTexto(busqueda.trim());
        const minimo = precioMinimo.trim() === "" ? null : Number(precioMinimo);
        const maximo = precioMaximo.trim() === "" ? null : Number(precioMaximo);
        if ( minimo !== null &&  maximo !== null &&  maximo < minimo) return [];

        const filtradas = publicaciones.filter((publicacion) => {
            if (especie !== "Todas" && publicacion.especie !== especie) return false;
            if (variedad !== "Todas" && publicacion.variedad !== variedad) return false;
            if (envase !== "Todas" && publicacion.envase !== envase) return false;
            if (kilos !== "Todas" && publicacion.kilos !== kilos) return false;
            if (categoria !== "Todas" && publicacion.categoria !== categoria) return false;
            if (calibre !== "Todas" && publicacion.calibre !== calibre) return false;

            if (textoBusqueda !== "") {
                const palabrasBusqueda = textoBusqueda.split(/\s+/);
                const camposBusqueda = [
                    publicacion.especie,
                    publicacion.variedad,
                    publicacion.envase,
                    publicacion.kilos,
                    publicacion.categoria,
                    publicacion.calibre,
                    publicacion.codigoCalibre,
                    obtenerNombreFantasia(publicacion),
                ].map(normalizarTexto);
                const coincide = palabrasBusqueda.every((palabra) =>
                    camposBusqueda.some((campo) => campo.includes(palabra))
                );
                if (!coincide) return false;
            }
            if (minimo !== null && !Number.isNaN(minimo) && (publicacion.precio == null || publicacion.precio < minimo)) return false;
            if (maximo !== null && !Number.isNaN(maximo) && (publicacion.precio == null || publicacion.precio > maximo)) return false;

            return true;
        });

        if (filtradas.every((publicacion): publicacion is T & PublicacionListado => publicacion.tipoPublicacion === "OPERADOR")) return [...filtradas].sort((a, b) => compararPublicacionesOperador(a, b, orden)); 
        if (orden === "precioAsc") return [...filtradas].sort((a, b) => compararPrecios(a, b, true));
        if (orden === "precioDesc") return [...filtradas].sort((a, b) => compararPrecios(a, b, false));
        if (orden === "prioridad") return [...filtradas].sort(compararPublicacionesPorPrioridad);
        if (orden === "alfabeticoAsc") return [...filtradas].sort(compararPublicacionesAlfabeticamente);
        if (orden === "alfabeticoDesc") return [...filtradas].sort((a, b) => compararPublicacionesAlfabeticamente(b, a));
        if (orden === "fechaDesc") {return [...filtradas].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())}
        return filtradas;
    }, [publicaciones, opcionesRemotas, especie, variedad, envase, kilos, categoria, calibre, busqueda, precioMinimo, precioMaximo, orden, obtenerNombreFantasia]);

    useEffect(() => {
        alConsultar?.({ busqueda, especie, variedad, envase, kilos, categoria, calibre, precioMinimo, precioMaximo, orden, ...(mostrarNave ? { nave } : {}) });
    }, [alConsultar, busqueda, especie, variedad, envase, kilos, categoria, calibre, precioMinimo, precioMaximo, orden, mostrarNave, nave]);

    const cantidadResultados = totalRemoto ?? publicacionesFiltradas.length;

    useEffect(() => { alFiltrar?.(publicacionesFiltradas) }, [publicacionesFiltradas, alFiltrar]);

    const cambiarOrden = (nuevoOrden: OrdenPublicaciones | "predeterminado") => {
        setOrden(nuevoOrden);
        alCambiarOrden?.(nuevoOrden === "predeterminado" ? ordenInicial : nuevoOrden);
    };

    const variedadUnica = (especie !== "Todas" && variedades.length === 1 && variedades[0] === "-");

    const limpiarFiltros = () => {
        setBusqueda("");
        setPrecioMinimo("");
        setPrecioMaximo("");

        setEspecie("Todas");
        especieNotificada.current = "Todas";
        setVariedad("Todas");
        setEnvase("Todas");
        setKilos("Todas");
        setCategoria("Todas");
        setCalibre("Todas");
        setNave("Todas");

        setOrden("predeterminado");
        alCambiarOrden?.(ordenInicial);
        alLimpiar?.();
    };

    const rangoPrecioInvalido = precioMinimo !== "" && precioMaximo !== "" && Number(precioMaximo) < Number(precioMinimo);

    const manejarCambioEspecie = (nuevaEspecie: string) => {
        let publicacionesBase = opciones;
        if (nuevaEspecie !== "Todas")  publicacionesBase = publicacionesBase.filter((publicacion) => publicacion.especie === nuevaEspecie);
        const variedadesNuevas = [...new Set(publicacionesBase.map((p) => p.variedad))].sort(compararOpciones);
        const nuevaVariedad =  nuevaEspecie !== "Todas" && variedadesNuevas.length === 1 && variedadesNuevas[0] === "-" ? "-" : "Todas";
        const nuevoEnvase = envase;
        const publicacionesNuevas = obtenerPublicacionesJerarquia(nuevaEspecie, nuevaVariedad, nuevoEnvase, kilos);
        ajustarFiltrosCategoriaCalibre(publicacionesNuevas);
        setEspecie(nuevaEspecie);
        setVariedad(nuevaVariedad);
        setEnvase(nuevoEnvase);
        especieNotificada.current = nuevaEspecie;
        alCambiarEspecie?.(nuevaEspecie);
    };

    const manejarCambioVariedad = (nuevaVariedad: string) => {
        const nuevoEnvase = envase;
        const publicacionesNuevas = obtenerPublicacionesJerarquia(especie, nuevaVariedad, nuevoEnvase, kilos);
        ajustarFiltrosCategoriaCalibre(publicacionesNuevas);
        setVariedad(nuevaVariedad);
        setEnvase(nuevoEnvase);
    };

    const manejarCambioEnvase = (nuevoEnvase: string) => {
        const publicacionesNuevas = obtenerPublicacionesJerarquia(especie, variedad, nuevoEnvase, kilos);
        ajustarFiltrosCategoriaCalibre(publicacionesNuevas);
        setEnvase(nuevoEnvase);
    };

    const manejarCambioKilos = (nuevosKilos: string) => {
        const publicacionesNuevas = obtenerPublicacionesJerarquia(especie, variedad, envase, nuevosKilos);
        ajustarFiltrosCategoriaCalibre(publicacionesNuevas);
        setKilos(nuevosKilos);
    };

    const manejarCambioCategoria = (nuevaCategoria: string) => {
        const calibreValido = nuevaCategoria === "Todas" || calibre === "Todas" || publicacionesSegunJerarquia.some((publicacion) =>
            publicacion.categoria === nuevaCategoria && publicacion.calibre === calibre);
        setCategoria(nuevaCategoria);
        setUltimaFaceta("categoria");
        if (!calibreValido) setCalibre("Todas");
    };

    const manejarCambioCalibre = (nuevoCalibre: string) => {
        const categoriaValida = nuevoCalibre === "Todas" || categoria === "Todas" || publicacionesSegunJerarquia.some( (publicacion) =>
            publicacion.calibre === nuevoCalibre && publicacion.categoria === categoria);
        setCalibre(nuevoCalibre);
        setUltimaFaceta("calibre");
        if (!categoriaValida) setCategoria("Todas");
    };

    return (
        <div className={styles.contenedor}>
            <AvisoErrorToast mensaje={rangoPrecioInvalido ? "El precio máximo no puede ser menor al mínimo." : null} />
            <div className={`${styles.layoutFiltros} ${mostrarFiltros ? styles.filtrosAbiertos : ""} ${mostrarNave ? styles.conFiltroNave : ""}`}>
                <TextField fullWidth size="small" label="Buscar publicaciones" type="search" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} className={`${styles.selectMui} ${styles.filtroBuscador}`}
                    slotProps={{input: {startAdornment: (<SearchIcon aria-hidden="true" sx={{ color: "var(--color-muted)" }}/>)}}}
                />
                <TextField select fullWidth label="Especie" value={especie} onChange={(e) => manejarCambioEspecie(e.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroEspecie}`} slotProps={propiedadesMenuSelect}>
                    <MenuItem value="Todas" className={styles.opcionSelect}>
                        Todas
                    </MenuItem>
                    {especies.map((opcion) => (
                        <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>
                            {opcion}
                        </MenuItem>
                    ))}
                </TextField>
                {mostrarNave && (
                    <TextField select fullWidth label="Nave" value={nave} onChange={(evento) => setNave(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroNave}`} slotProps={propiedadesMenuSelect}>
                        <MenuItem value="Todas" className={styles.opcionSelect}>Todas</MenuItem>
                        {naves.map((opcion) => (
                            <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>
                                {opcion === "Tinglado" ? opcion : `Nave ${opcion}`}
                            </MenuItem>
                        ))}
                    </TextField>
                )}
                <div className={styles.filtroPrecioMinimo}>
                    <TextField fullWidth size="small" id="precio-minimo" label="Precio Mínimo" type="text" value={precioMinimo} placeholder="Sin mínimo" className={styles.selectMui}
                        slotProps={{
                            htmlInput: {
                                inputMode: "numeric",
                                pattern: "0*[1-9][0-9]*",
                                maxLength: MAXIMO_DIGITOS_PRECIO,
                            },
                        }}
                        onChange={(evento) => {
                            const valor = evento.target.value;
                            if (esEntradaPrecioPublicacion(valor)) setPrecioMinimo(valor);
                        }}
                    />
                </div>
                <div className={styles.filtroPrecioMaximo}>
                    <TextField fullWidth size="small" id="precio-maximo" label="Precio Máximo" type="text" value={precioMaximo} placeholder="Sin máximo" className={styles.selectMui} error={rangoPrecioInvalido}
                        slotProps={{
                            htmlInput: {
                                inputMode: "numeric",
                                pattern: "0*[1-9][0-9]*",
                                maxLength: MAXIMO_DIGITOS_PRECIO,
                            },
                        }}
                        onChange={(evento) => {
                            const valor = evento.target.value;
                            if (esEntradaPrecioPublicacion(valor)) setPrecioMaximo(valor);
                        }}
                    />
                </div>
                <div id={idFiltrosExtendidos} className={styles.filtrosExtendidos}>
                    <div className={styles.filtrosVariedadEnvase}>
                        <TextField select fullWidth label="Variedad" value={variedadUnica ? "-" : variedad} onChange={(e) => manejarCambioVariedad(e.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroVariedad}`} disabled={especie === "Todas" || variedadUnica} slotProps={propiedadesMenuSelect}>
                            {!variedadUnica && (
                                <MenuItem value="Todas" className={styles.opcionSelect}>
                                    Todas
                                </MenuItem>
                            )}
                            {variedades.map((opcion) => (
                                <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>
                                    {opcion}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField select fullWidth label="Empaquetado" value={envase} onChange={(evento) => manejarCambioEnvase(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroEnvase}`} slotProps={propiedadesMenuSelect}>
                            <MenuItem value="Todas" className={styles.opcionSelect}>
                                Todos
                            </MenuItem>
                            {envases.map((opcion) => (
                                <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>
                                    {opcion}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField select fullWidth label="Kilos" value={kilos} onChange={(evento) => manejarCambioKilos(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroKilos}`} slotProps={propiedadesMenuSelect}>
                            <MenuItem value="Todas" className={styles.opcionSelect}>Todos</MenuItem>
                            {opcionesKilos.map((opcion) => <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>{opcion === "-" ? "-" : `${opcion} kg`}</MenuItem>)}
                        </TextField>
                    </div>
                    <div className={styles.filtrosCategoriaCalibre}>
                        <TextField select fullWidth label="Categoría" value={categorias.includes(categoria) ? categoria : "Todas"} onChange={(evento) => manejarCambioCategoria(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroCategoria}`} slotProps={propiedadesMenuSelect}>
                            <MenuItem value="Todas" className={styles.opcionSelect}>
                                Todas
                            </MenuItem>
                            {categorias.map((opcion) => (
                                <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>
                                    {opcion}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField select fullWidth label="Calibre" value={calibres.includes(calibre) ? calibre : "Todas"} onChange={(evento) => manejarCambioCalibre(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroCalibre}`} slotProps={propiedadesMenuSelect}>
                            <MenuItem value="Todas" className={styles.opcionSelect}>
                                Todos
                            </MenuItem>
                            {calibres.map((opcion) => (
                                <MenuItem
                                    key={opcion}
                                    value={opcion}
                                    className={styles.opcionSelect}
                                >
                                    {opcion}
                                </MenuItem>
                            ))}
                        </TextField>
                    </div>
                </div>
                <div className={styles.barraOpciones}>
                    <BotonDesplegable className={styles.botonExtendidos} abierto={mostrarFiltros} aria-controls={idFiltrosExtendidos} onClick={() => setMostrarFiltros((valorActual) => !valorActual)}>
                        Más filtros
                    </BotonDesplegable>
                    {ordenamientoHabilitado && (
                        <BotonOrdenar<OrdenPublicaciones | "predeterminado">
                            valor={ordenElegido}
                            alCambiar={cambiarOrden}
                            className={styles.botonOrdenar}
                            opciones={[
                                { valor: "predeterminado", etiqueta: "Por volumen" },
                                { valor: "precioAsc", etiqueta: "Menor Precio" },
                                { valor: "precioDesc", etiqueta: "Mayor Precio" },
                                { valor: "alfabeticoAsc", etiqueta: "A-Z" },
                                { valor: "alfabeticoDesc", etiqueta: "Z-A" },
                                { valor: "fechaDesc", etiqueta: "Más actualizadas" },
                            ]}
                        />
                    )}
                </div>
            </div>

            <div className={styles.pie}>
                <span className={styles.resultados}> {cantidadResultados}{" "} {cantidadResultados === 1 ? "publicación" : "publicaciones"}</span>
                <button type="button" className={styles.limpiar} onClick={limpiarFiltros}> Limpiar filtros </button>
            </div>
        </div>
    );
}
