"use client";

import { useEffect, useMemo, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { MenuItem, TextField } from "@mui/material";
import styles from "./FiltrosPublicaciones.module.css";

// Tipo de datos que recibe
export type PublicacionListado = {
    id: number;
    precio: number | null;
    foto: string | null;
    especie: string;
    variedad: string;
    presentacion: string;
    categoria: string;
    calibre: string;
    codigoCalibre: string;
    operador: {
        id: number;
        nombreFantasia: string;
        whatsApp: string;
    };
};

type FiltrosPublicacionesProps = {
    publicaciones: PublicacionListado[];
    alFiltrar?: (publicaciones: PublicacionListado[]) => void;
};

export default function FiltrosPublicaciones({publicaciones, alFiltrar}: FiltrosPublicacionesProps) {
    // Hooks useState para los filtros
    const [busqueda, setBusqueda] = useState("");               // Barra de busqueda
    const [precioMinimo, setPrecioMinimo] = useState("");       // Precio Minimo
    const [precioMaximo, setPrecioMaximo] = useState("");       // Precio Maximo
    const [especie, setEspecie] = useState("Todas");            // Filtro Especie
    const [variedad, setVariedad] = useState("Todas");          // Filtro Variedad
    const [presentacion, setPresentacion] = useState("Todas");  // Filtro Presentacion
    const [categoria, setCategoria] = useState("Todas");        // Filtro Categoria
    const [calibre, setCalibre] = useState("Todas");            // Filtro Calibre

    // Mostrar Filtros extendidos
    const [mostrarFiltros, setMostrarFiltros] = useState(false);

    // Mostrar Filtros de Ordenamiento
    const [mostrarOrdenamiento, setMostrarOrdenamiento] = useState(false);

    // Filtros de Ordenamiento
    const [orden, setOrden] = useState("ninguno");

    // Valores luego del debounce
    const [busquedaAplicada, setBusquedaAplicada] = useState("");
    const [precioMinimoAplicado, setPrecioMinimoAplicado] = useState("");
    const [precioMaximoAplicado, setPrecioMaximoAplicado] = useState("");

    // Opciones de Filtros disponibles
    const especies = useMemo(() => {
        return [...new Set(publicaciones.map((publicacion) => publicacion.especie))].sort();
    }, [publicaciones]);

    const variedades = useMemo(() => {
        let publicacionesBase = publicaciones;
        if (especie !== "Todas") {
            publicacionesBase = publicacionesBase.filter((publicacion) =>
                publicacion.especie === especie
            );
        }
        return [...new Set(publicacionesBase.map((publicacion) => publicacion.variedad))].sort();
    }, [publicaciones, especie]);

    const presentaciones = useMemo(() => {
        let publicacionesBase = publicaciones;
        if (especie !== "Todas") {
            publicacionesBase = publicacionesBase.filter((publicacion) =>
                publicacion.especie === especie
            );
        }
        if (variedad !== "Todas") {
            publicacionesBase = publicacionesBase.filter((publicacion) =>
                publicacion.variedad === variedad
            );
        }
        return [...new Set(publicacionesBase.map((publicacion) =>  publicacion.presentacion))].sort();
    }, [publicaciones, especie, variedad]);

    const categorias = useMemo(() => { return [...new Set(publicaciones.map((publicacion) => publicacion.categoria))].sort() }, [publicaciones]);

    const calibres = useMemo(() => {
        let publicacionesBase = publicaciones;
        if (especie !== "Todas") {
            publicacionesBase = publicacionesBase.filter((publicacion) =>
                publicacion.especie === especie
            );
        }
        return [...new Set(publicacionesBase.map((publicacion) => publicacion.calibre))].sort();
    }, [publicaciones, especie]);

    // Busqueda de precios y Debounce
    useEffect(() => {
        const temporizador = setTimeout(() => {
            setBusquedaAplicada(busqueda);
            setPrecioMinimoAplicado(precioMinimo);
            setPrecioMaximoAplicado(precioMaximo);
        }, 750);
        return () => { clearTimeout(temporizador) };
    }, [busqueda, precioMinimo, precioMaximo]);

    const compararPrecios = (a: PublicacionListado, b: PublicacionListado, ascendente: boolean) => {
        if (a.precio == null && b.precio == null) return 0;
        if (a.precio == null) return 1;
        if (b.precio == null) return -1;
        return ascendente ? a.precio - b.precio : b.precio - a.precio;
    }; 

    // Aplicacion de Filtros
    const publicacionesFiltradas = useMemo(() => {
        const textoBusqueda = busquedaAplicada.trim().toLowerCase();

        const minimo = precioMinimoAplicado.trim() === "" ? null : Number(precioMinimoAplicado);

        const maximo = precioMaximoAplicado.trim() === "" ? null : Number(precioMaximoAplicado);

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
                ].map((campo) => campo.toLowerCase());
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
        if (orden === "alfabeticoAsc") {
            return [...filtradas].sort((a, b) => {
                const especie = a.especie.localeCompare(b.especie);
                if (especie !== 0) return especie;
                return a.variedad.localeCompare(b.variedad);
            });
        }
        if (orden === "alfabeticoDesc") {
            return [...filtradas].sort((a, b) => {
                const especie = b.especie.localeCompare(a.especie);
                if (especie !== 0) return especie;
                return b.variedad.localeCompare(a.variedad);
            });
        }


        return filtradas;
    }, [publicaciones, especie, variedad, presentacion, categoria, calibre, busquedaAplicada, precioMinimoAplicado, precioMaximoAplicado, orden]);
    
    // Devolver al Componente Padre
    useEffect(() => { alFiltrar?.(publicacionesFiltradas) }, [publicacionesFiltradas, alFiltrar]);

    // Variedad Unica
    const variedadUnica = (especie !== "Todas" && variedades.length === 1 && variedades[0] === "-");

    // Limpiar filtros
    const limpiarFiltros = () => {
        setBusqueda("");
        setPrecioMinimo("");
        setPrecioMaximo("");

        setBusquedaAplicada("");
        setPrecioMinimoAplicado("");
        setPrecioMaximoAplicado("");

        setEspecie("Todas");
        setVariedad("Todas");
        setPresentacion("Todas");
        setCategoria("Todas");
        setCalibre("Todas");

        setOrden("ninguno");
    };

    // Rango de precio invalido
    const rangoPrecioInvalido = precioMinimo !== "" && precioMaximo !== "" && Number(precioMaximo) < Number(precioMinimo);

    // Manejador para el cambio de Especie
    const manejarCambioEspecie = (nuevaEspecie: string) => {
        setEspecie(nuevaEspecie);
        setCalibre("Todas");

        // Calcular las variedades filtradas con la nueva especie
        let publicacionesBase = publicaciones;
        if (nuevaEspecie !== "Todas") {
            publicacionesBase = publicacionesBase.filter(
                (p) => p.especie === nuevaEspecie
            );
        }
        const variedadesNuevas = [
            ...new Set(publicacionesBase.map((p) => p.variedad)),
        ].sort();

        if (
            nuevaEspecie !== "Todas" &&
            variedadesNuevas.length === 1 &&
            variedadesNuevas[0] === "-"
        ) {
            setVariedad("-");
        } else {
            setVariedad("Todas");
        }
        setPresentacion("Todas");
    };

    // Manejador para el cambio de Variedad
    const manejarCambioVariedad = (nuevaVariedad: string) => {
        setVariedad(nuevaVariedad);
        setPresentacion("Todas");
    };

    return (
        <div className={styles.contenedor}>
            <div className={`${styles.layoutFiltros} ${mostrarFiltros ? styles.filtrosAbiertos : ""} ${rangoPrecioInvalido ? styles.rangoInvalido : ""}`}>
                {/* Barra de búsqueda */}
                <TextField fullWidth size="small" label="Buscar publicaciones" type="search" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} className={`${styles.selectMui} ${styles.filtroBuscador}`}
                    slotProps={{input: {startAdornment: (<SearchIcon aria-hidden="true" sx={{ color: "var(--color-muted)" }}/>)}}}
                />
                {/* Especie */}
                <TextField select fullWidth label="Especie" value={especie} onChange={(e) => manejarCambioEspecie(e.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroEspecie}`}>
                    <MenuItem value="Todas" className={styles.opcionSelect}>
                        Todas
                    </MenuItem>
                    {especies.map((opcion) => (
                        <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>
                            {opcion}
                        </MenuItem>
                    ))}
                </TextField>
                {/* Precio mínimo */}
                <div className={styles.filtroPrecioMinimo}>
                    <TextField fullWidth size="small" id="precio-minimo" label="Precio Mínimo" type="number" value={precioMinimo} placeholder="$ 0" className={styles.selectMui}
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                inputMode: "numeric",
                            },
                        }}
                        onChange={(evento) => {
                            const valor = evento.target.value;
                            if (valor === "" || Number(valor) >= 0) setPrecioMinimo(valor)
                        }}
                    />
                </div>
                {/* Precio máximo */}
                <div className={styles.filtroPrecioMaximo}>
                    <TextField fullWidth size="small" id="precio-maximo" label="Precio Máximo" type="number" value={precioMaximo} placeholder="Sin límite" className={styles.selectMui} error={rangoPrecioInvalido}
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                inputMode: "numeric",
                            },
                        }}
                        onChange={(evento) => {
                            const valor = evento.target.value;
                            if (valor === "" || Number(valor) >= 0)  setPrecioMaximo(valor)
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
                        <TextField select fullWidth label="Variedad" value={variedadUnica ? "-" : variedad} onChange={(e) => manejarCambioVariedad(e.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroVariedad}`} disabled={especie === "Todas" || variedadUnica}>
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
                        {/* Presentación */}
                        <TextField select fullWidth label="Presentación" value={presentacion} onChange={(evento) => setPresentacion(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroPresentacion}`} disabled={variedad === "Todas"}>
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
                        {/* Categoría */}
                        <TextField select fullWidth label="Categoría" value={categoria} onChange={(evento) => setCategoria(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroCategoria}`}>
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
                        <TextField select fullWidth label="Calibre" value={calibre} onChange={(evento) => setCalibre(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroCalibre}`}>
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
                    {/* Más filtros */}
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
                        <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "ninguno" ? styles.opcionOrdenamientoActiva : ""}`}
                            onClick={() => {
                                setOrden("ninguno");
                                setMostrarOrdenamiento(false);
                            }}>
                            Sin ordenar
                        </button>
                        <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "precioAsc" ? styles.opcionOrdenamientoActiva : ""}`}
                            onClick={() => {
                                setOrden("precioAsc");
                                setMostrarOrdenamiento(false);
                            }}>
                            Menor Precio
                        </button>
                        <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "precioDesc" ? styles.opcionOrdenamientoActiva : ""}`}
                            onClick={() => {
                                setOrden("precioDesc");
                                setMostrarOrdenamiento(false);
                            }}>
                            Mayor Precio
                        </button>
                        <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "alfabeticoAsc" ? styles.opcionOrdenamientoActiva : ""}`}
                            onClick={() => {
                                setOrden("alfabeticoAsc");
                                setMostrarOrdenamiento(false);
                            }}>
                            A-Z
                        </button>
                        <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "alfabeticoDesc" ? styles.opcionOrdenamientoActiva : ""}`}
                            onClick={() => {
                                setOrden("alfabeticoDesc");
                                setMostrarOrdenamiento(false);
                            }}>
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