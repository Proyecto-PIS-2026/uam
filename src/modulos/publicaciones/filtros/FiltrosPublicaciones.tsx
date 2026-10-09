"use client";

import { useEffect, useMemo, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { MenuItem, TextField } from "@mui/material";
import { compararEspeciesPorPrioridad } from "../../../compartido/prioridad-especies";
import styles from "./FiltrosPublicaciones.module.css";

import type { PublicacionListado } from "../../consulta-mercado/acciones/Publicaciones";

const propiedadesMenuSelect = { select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } } as const;

function normalizarTexto(texto: string) {
    return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const compararOpciones = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" })

export type OrdenPublicaciones = "ninguno" | "prioridad" | "precioAsc" | "precioDesc" | "alfabeticoAsc" | "alfabeticoDesc";

export function compararPublicacionesAlfabeticamente(a: Pick<PublicacionListado, "especie" | "variedad">, b: Pick<PublicacionListado, "especie" | "variedad">) {
    const especie = compararOpciones(a.especie, b.especie);
    return especie !== 0 ? especie : compararOpciones(a.variedad, b.variedad);
}

export function compararPublicacionesPorPrioridad(a: Pick<PublicacionListado, "especie" | "variedad">, b: Pick<PublicacionListado, "especie" | "variedad">) {
    const especie = compararEspeciesPorPrioridad(a.especie, b.especie);
    return especie !== 0 ? especie : compararOpciones(a.variedad, b.variedad);
}

type FiltrosPublicacionesProps = {
    publicaciones: PublicacionListado[];
    especieFiltro: string;
    alFiltrar?: (publicaciones: PublicacionListado[]) => void;
    alLimpiar?: () => void;
    ordenInicial?: OrdenPublicaciones;
    alCambiarOrden?: (orden: OrdenPublicaciones) => void;
};

export default function FiltrosPublicaciones({publicaciones, especieFiltro, alFiltrar, alLimpiar, ordenInicial = "ninguno", alCambiarOrden}: FiltrosPublicacionesProps) {
    // Hooks useState para los filtros
    const [busqueda, setBusqueda] = useState("");                                           // Barra de busqueda
    const [precioMinimo, setPrecioMinimo] = useState("");                                   // Precio Minimo
    const [precioMaximo, setPrecioMaximo] = useState("");                                   // Precio Maximo
    const [especie, setEspecie] = useState(especieFiltro === "" ? "Todas" : especieFiltro); // Filtro Especie
    const [variedad, setVariedad] = useState("Todas");                                      // Filtro Variedad
    const [presentacion, setPresentacion] = useState("Todas");                              // Filtro Presentacion
    const [categoria, setCategoria] = useState("Todas");                                    // Filtro Categoria
    const [calibre, setCalibre] = useState("Todas");                                        // Filtro Calibre

    const [ultimaFaceta, setUltimaFaceta] = useState<"categoria" | "calibre" | null>(null);

    // Mostrar Filtros extendidos
    const [mostrarFiltros, setMostrarFiltros] = useState(false);

    // Mostrar Filtros de Ordenamiento
    const [mostrarOrdenamiento, setMostrarOrdenamiento] = useState(false);

    // Filtros de Ordenamiento
    const [orden, setOrden] = useState<OrdenPublicaciones>(ordenInicial);

    // Opciones de Filtros disponibles
    const especies = useMemo(() => {
        const nombres = [...new Set(publicaciones.map((publicacion) => publicacion.especie))];
        return nombres.sort(ordenInicial === "prioridad" ? compararEspeciesPorPrioridad : compararOpciones);
    }, [publicaciones, ordenInicial]);

    // Opciones de Variedad disponibles segun Especie
    const variedades = useMemo(() => {
        let publicacionesBase = publicaciones;
        if (especie !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.especie === especie);

        return [...new Set(publicacionesBase.map((publicacion) => publicacion.variedad))].sort(compararOpciones);
    }, [publicaciones, especie]);

    // Publicaciones segun Especie, Variedad y Presentacion
    const publicacionesSegunJerarquia = useMemo(() => {
        let publicacionesBase = publicaciones;
        if (especie !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) => 
            publicacion.especie === especie);
        if (variedad !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) => 
            publicacion.variedad === variedad);
        if (presentacion !== "Todas")  publicacionesBase = publicacionesBase.filter((publicacion) => 
            publicacion.presentacion === presentacion);

        return publicacionesBase;
    }, [publicaciones, especie, variedad, presentacion]);

    // Opciones de Presentacion disponibles segun Especie y Variedad
    const presentaciones = useMemo(() => {
        let publicacionesBase = publicaciones;
        if (especie !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.especie === especie);
        if (variedad !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.variedad === variedad);

        return [...new Set(publicacionesBase.map((publicacion) =>  publicacion.presentacion))].sort(compararOpciones);
    }, [publicaciones, especie, variedad]);

    // Opciones de Categoria disponibles segun Calibre
    const categorias = useMemo(() => {
        let publicacionesBase = publicacionesSegunJerarquia;

        if (calibre !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) => 
            publicacion.calibre === calibre);

        return [...new Set(publicacionesBase.map((publicacion) => publicacion.categoria))].sort(compararOpciones);
    }, [publicacionesSegunJerarquia, calibre]);

    // Opciones de Calibre disponibles segun Categoria
    const calibres = useMemo(() => {
        let publicacionesBase = publicacionesSegunJerarquia;
        if (categoria !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) => 
            publicacion.categoria === categoria);

        return [...new Set(publicacionesBase.map((publicacion) => publicacion.calibre))].sort(compararOpciones);
    }, [publicacionesSegunJerarquia, categoria]);

    // Obtener Publicaciones segun la jerarquia de filtros
    const obtenerPublicacionesJerarquia = (nuevaEspecie: string, nuevaVariedad: string, nuevaPresentacion: string) => {
        let publicacionesBase = publicaciones;
        if (nuevaEspecie !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) => 
            publicacion.especie === nuevaEspecie);
        if (nuevaVariedad !== "Todas")  publicacionesBase = publicacionesBase.filter((publicacion) => 
            publicacion.variedad === nuevaVariedad);
        if (nuevaPresentacion !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) => 
            publicacion.presentacion === nuevaPresentacion);

        return publicacionesBase;
    };

    // Ajuste de filtros de Categoria y Calibre
    const ajustarFiltrosCategoriaCalibre = (publicacionesBase: PublicacionListado[]) => {
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

    // Comparacion de Precios
    const compararPrecios = (a: PublicacionListado, b: PublicacionListado, ascendente: boolean) => {
        if (a.precio == null && b.precio == null) return 0;
        if (a.precio == null) return 1;
        if (b.precio == null) return -1;

        return ascendente ? a.precio - b.precio : b.precio - a.precio;
    }; 

    // Aplicacion de Filtros
    const publicacionesFiltradas = useMemo(() => {
        const textoBusqueda = normalizarTexto(busqueda.trim());
        const minimo = precioMinimo.trim() === "" ? null : Number(precioMinimo);
        const maximo = precioMaximo.trim() === "" ? null : Number(precioMaximo);
        if ( minimo !== null &&  maximo !== null &&  maximo < minimo) return [];

        const filtradas = publicaciones.filter((publicacion) => {
            if (especie !== "Todas" && publicacion.especie !== especie) return false;
            if (variedad !== "Todas" && publicacion.variedad !== variedad) return false;
            if (presentacion !== "Todas" && publicacion.presentacion !== presentacion) return false;
            if (categoria !== "Todas" && publicacion.categoria !== categoria) return false;
            if (calibre !== "Todas" && publicacion.calibre !== calibre) return false;
            
            // Filtro de busqueda
            if (textoBusqueda !== "") {
                const palabrasBusqueda = textoBusqueda.split(/\s+/);
                const camposBusqueda = [
                    publicacion.especie,
                    publicacion.variedad,
                    publicacion.presentacion,
                    publicacion.categoria,
                    publicacion.calibre,
                    publicacion.codigoCalibre,
                    publicacion.operador.nombreFantasia,
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

        // Ordenamiento
        if (orden === "precioAsc") return [...filtradas].sort((a, b) => compararPrecios(a, b, true));
        if (orden === "precioDesc") return [...filtradas].sort((a, b) => compararPrecios(a, b, false));
        if (orden === "prioridad") return [...filtradas].sort(compararPublicacionesPorPrioridad);
        if (orden === "alfabeticoAsc") return [...filtradas].sort(compararPublicacionesAlfabeticamente);
        if (orden === "alfabeticoDesc") return [...filtradas].sort((a, b) => compararPublicacionesAlfabeticamente(b, a));

        return filtradas;
    }, [publicaciones, especie, variedad, presentacion, categoria, calibre, busqueda, precioMinimo, precioMaximo, orden]);
    
    // Devolver al Componente Padre
    useEffect(() => { alFiltrar?.(publicacionesFiltradas) }, [publicacionesFiltradas, alFiltrar]);

    const cambiarOrden = (nuevoOrden: OrdenPublicaciones) => {
        setOrden(nuevoOrden);
        alCambiarOrden?.(nuevoOrden);
        setMostrarOrdenamiento(false);
    };

    // Variedad Unica
    const variedadUnica = (especie !== "Todas" && variedades.length === 1 && variedades[0] === "-");

    // Limpiar filtros
    const limpiarFiltros = () => {
        setBusqueda("");
        setPrecioMinimo("");
        setPrecioMaximo("");

        setEspecie("Todas");
        setVariedad("Todas");
        setPresentacion("Todas");
        setCategoria("Todas");
        setCalibre("Todas");

        if (ordenInicial !== "prioridad") {
            setOrden(ordenInicial);
            alCambiarOrden?.(ordenInicial);
        }
        alLimpiar?.();
    };

    // Rango de precio invalido
    const rangoPrecioInvalido = precioMinimo !== "" && precioMaximo !== "" && Number(precioMaximo) < Number(precioMinimo);

    // Manejador para el cambio de Especie
    const manejarCambioEspecie = (nuevaEspecie: string) => {
        let publicacionesBase = publicaciones;
        if (nuevaEspecie !== "Todas")  publicacionesBase = publicacionesBase.filter((publicacion) => publicacion.especie === nuevaEspecie);
        const variedadesNuevas = [...new Set(publicacionesBase.map((p) => p.variedad))].sort(compararOpciones);
        const nuevaVariedad =  nuevaEspecie !== "Todas" && variedadesNuevas.length === 1 && variedadesNuevas[0] === "-" ? "-" : "Todas";
        const nuevaPresentacion = "Todas";
        const publicacionesNuevas = obtenerPublicacionesJerarquia(nuevaEspecie, nuevaVariedad, nuevaPresentacion);
        ajustarFiltrosCategoriaCalibre(publicacionesNuevas);
        setEspecie(nuevaEspecie);
        setVariedad(nuevaVariedad);
        setPresentacion(nuevaPresentacion);
    };

    // Manejador para el cambio de Variedad
    const manejarCambioVariedad = (nuevaVariedad: string) => {
        const nuevaPresentacion = "Todas";
        const publicacionesNuevas = obtenerPublicacionesJerarquia(especie, nuevaVariedad, nuevaPresentacion);
        ajustarFiltrosCategoriaCalibre(publicacionesNuevas);
        setVariedad(nuevaVariedad);
        setPresentacion(nuevaPresentacion);
    };

    // Manejador para el cambio de Presentacion
    const manejarCambioPresentacion = (nuevaPresentacion: string) => {
        const publicacionesNuevas = obtenerPublicacionesJerarquia(especie, variedad, nuevaPresentacion);
        ajustarFiltrosCategoriaCalibre(publicacionesNuevas);
        setPresentacion(nuevaPresentacion);
    };

    // Manejador para el cambio de Categoria
    const manejarCambioCategoria = (nuevaCategoria: string) => {
        const calibreValido = nuevaCategoria === "Todas" || calibre === "Todas" || publicacionesSegunJerarquia.some((publicacion) =>
            publicacion.categoria === nuevaCategoria && publicacion.calibre === calibre);
        setCategoria(nuevaCategoria);
        setUltimaFaceta("categoria");
        if (!calibreValido) setCalibre("Todas");
    };

    // Manejador para el cambio de Calibre
    const manejarCambioCalibre = (nuevoCalibre: string) => {
        const categoriaValida = nuevoCalibre === "Todas" || categoria === "Todas" || publicacionesSegunJerarquia.some( (publicacion) => 
            publicacion.calibre === nuevoCalibre && publicacion.categoria === categoria);
        setCalibre(nuevoCalibre);
        setUltimaFaceta("calibre");
        if (!categoriaValida) setCategoria("Todas");
    };

    return (
        <div className={styles.contenedor}>
            <div className={`${styles.layoutFiltros} ${mostrarFiltros ? styles.filtrosAbiertos : ""} ${rangoPrecioInvalido ? styles.rangoInvalido : ""}`}>
                {/* Barra de busqueda */}
                <TextField fullWidth size="small" label="Buscar publicaciones" type="search" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} className={`${styles.selectMui} ${styles.filtroBuscador}`}
                    slotProps={{input: {startAdornment: (<SearchIcon aria-hidden="true" sx={{ color: "var(--color-muted)" }}/>)}}}
                />
                {/* Especie */}
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
                {/* Precio minimo */}
                <div className={styles.filtroPrecioMinimo}>
                    <TextField fullWidth size="small" id="precio-minimo" label="Precio Mínimo" type="text" value={precioMinimo} placeholder="$ 0" className={styles.selectMui}
                        slotProps={{
                            htmlInput: {
                                inputMode: "numeric",
                                pattern: "[0-9]*",
                            },
                        }}
                        onChange={(evento) => {
                            const valor = evento.target.value;
                            if (/^[0-9]*$/.test(valor)) setPrecioMinimo(valor);
                        }}
                    />
                </div>
                {/* Precio maximo */}
                <div className={styles.filtroPrecioMaximo}>
                    <TextField fullWidth size="small" id="precio-maximo" label="Precio Máximo" type="text" value={precioMaximo} placeholder="Sin límite" className={styles.selectMui} error={rangoPrecioInvalido}
                        slotProps={{
                            htmlInput: {
                                inputMode: "numeric",
                                pattern: "[0-9]*",
                            },
                        }}
                        onChange={(evento) => {
                            const valor = evento.target.value;
                            if (/^[0-9]*$/.test(valor)) setPrecioMaximo(valor);
                        }}
                    />
                </div>
                {rangoPrecioInvalido && (
                    <span className={styles.mensajeError}>
                        El precio máximo no puede ser menor al mínimo.
                    </span>
                )}
                <div className={styles.filtrosExtendidos}>
                    <div className={styles.filtrosVariedadPresentacion}>
                        {/* Variedad */}
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
                        {/* Presentacion */}
                        <TextField select fullWidth label="Presentación" value={presentacion} onChange={(evento) => manejarCambioPresentacion(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroPresentacion}`} disabled={variedad === "Todas"} slotProps={propiedadesMenuSelect}>
                            <MenuItem value="Todas" className={styles.opcionSelect}>
                                Todas
                            </MenuItem>
                            {presentaciones.map((opcion) => (
                                <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>
                                    {opcion}
                                </MenuItem>
                            ))}
                        </TextField>
                    </div>
                    <div className={styles.filtrosCategoriaCalibre}>
                        {/* Categoria */}
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
                        {/* Calibre */}
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
                {/* Botones */}
                <div className={styles.barraOpciones}>
                    {/* Mas filtros */}
                    <button className={styles.botonExtendidos} type="button" onClick={() => setMostrarFiltros((valorActual) => !valorActual)}>
                        <span>Más filtros</span>
                        {mostrarFiltros ? (
                            <KeyboardArrowUpIcon
                                className={styles.iconoExpandir}
                            />
                        ) : (
                            <KeyboardArrowDownIcon
                                className={styles.iconoExpandir}
                            />
                        )}
                    </button>
                    {/* Ordenar por */}
                    <button className={styles.botonExtendidos} type="button" onClick={() => setMostrarOrdenamiento((valorActual) => !valorActual)}>
                        <span>Ordenar por</span>
                        {mostrarOrdenamiento ? (
                            <KeyboardArrowUpIcon
                                className={styles.iconoExpandir}
                            />
                        ) : (
                            <KeyboardArrowDownIcon
                                className={styles.iconoExpandir}
                            />
                        )}
                    </button>
                    {/* Opciones de ordenamiento */}
                    <div className={`${styles.listaOrdenamiento} ${mostrarOrdenamiento ? styles.listaOrdenamientoAbierta : ""}`}>
                        {ordenInicial !== "prioridad" && (
                            <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "ninguno" ? styles.opcionOrdenamientoActiva : ""}`}
                                onClick={() => cambiarOrden("ninguno")}>
                                Sin ordenar
                            </button>
                        )}
                        <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "precioAsc" ? styles.opcionOrdenamientoActiva : ""}`}
                            onClick={() => cambiarOrden("precioAsc")}>
                            Menor Precio
                        </button>
                        <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "precioDesc" ? styles.opcionOrdenamientoActiva : ""}`}
                            onClick={() => cambiarOrden("precioDesc")}>
                            Mayor Precio
                        </button>
                        <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "alfabeticoAsc" ? styles.opcionOrdenamientoActiva : ""}`}
                            onClick={() => cambiarOrden("alfabeticoAsc")}>
                            A-Z
                        </button>
                        <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "alfabeticoDesc" ? styles.opcionOrdenamientoActiva : ""}`}
                            onClick={() => cambiarOrden("alfabeticoDesc")}>
                            Z-A
                        </button>
                    </div>
                </div>
            </div>

            {/* Boton para limpiar filtros */}
            <div className={styles.pie}>
                <span className={styles.resultados}> {publicacionesFiltradas.length}{" "} {publicacionesFiltradas.length === 1 ? "publicación" : "publicaciones"}</span>
                <button type="button" className={styles.limpiar} onClick={limpiarFiltros}> Limpiar filtros </button>
            </div>
        </div>
    );
}
