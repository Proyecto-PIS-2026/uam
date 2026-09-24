"use client";

import { useEffect, useMemo, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { MenuItem, TextField } from "@mui/material";
import styles from "./FiltrosPublicaciones.module.css";
// import type { PublicacionListado } from "../../consulta-mercado/acciones/publicaciones";
// Borrar despues y descomentar el de arriba
export type PublicacionListado = {
    id: number;
    precio: number;
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

    // Cambio de Especie
    useEffect(() => {
        setCalibre("Todas");
        if (especie !== "Todas" && variedades.length === 1 &&  variedades[0] === "-") {
            setVariedad("-");
        } else {
            setVariedad("Todas");
        }
    }, [especie, variedades]);

    // Cambio de Variedad
    useEffect(() => { setPresentacion("Todas") }, [variedad]);

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

            if (minimo !== null && !Number.isNaN(minimo) && publicacion.precio < minimo) return false;
            if (maximo !== null && !Number.isNaN(maximo) && publicacion.precio > maximo) return false;
            return true;
        });

        // Ordenamiento
        if (orden === "precioAsc") return [...filtradas].sort((a, b) => a.precio - b.precio);
        if (orden === "precioDesc") return [...filtradas].sort((a, b) => b.precio - a.precio);
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

    return (
        <div className={styles.contenedor}>

            {/* Barra de busqueda */}
            <div className={styles.buscador}>
                <SearchIcon aria-hidden="true" className={styles.iconoBusqueda}/>
                <input className={styles.inputBusqueda} type="search" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar publicaciones"/>
            </div>

            {/* Filtros visibles */}
            <div className={styles.filtrosRapidos}>

                {/* Especie */}
                <TextField select label="Especie" value={especie} onChange={(evento) => setEspecie(evento.target.value)} size="small" className={styles.selectMui}>
                    <MenuItem value="Todas" className={styles.opcionSelect}> Todas </MenuItem>
                    {especies.map((opcion) => (<MenuItem key={opcion} value={opcion} className={styles.opcionSelect}> {opcion} </MenuItem>))}
                </TextField>

                {/* Precio Minimo */}
                <div className={styles.campo}>
                    <label className={styles.etiqueta} htmlFor="precio-minimo" > Precio Mínimo. </label>
                    <input id="precio-minimo" className={styles.inputPrecio} type="number" min="0" inputMode="numeric" value={precioMinimo}
                        onChange={(evento) => {
                            const valor = evento.target.value;
                            if (valor === "" || Number(valor) >= 0) setPrecioMinimo(valor);
                        }}
                        placeholder="$ 0"/>
                </div>

                {/* Precio Maximo */}
                <div className={styles.campo}>
                    <label className={styles.etiqueta} htmlFor="precio-maximo"> Precio máx. </label>
                    <input id="precio-maximo" className={`${styles.inputPrecio} ${rangoPrecioInvalido ? styles.inputPrecioError : ""}`} type="number" min="0" inputMode="numeric" value={precioMaximo}
                        onChange={(evento) => {
                            const valor = evento.target.value;
                            if (valor === "" || Number(valor) >= 0) setPrecioMaximo(valor);
                        }}
                        placeholder="Sin límite"/>
                </div>
            </div>
            
            {/* Advertencia si $Max < $Min */}
            {rangoPrecioInvalido && (<div className={styles.mensajeError}> El máximo debe ser mayor o igual al mínimo </div>)}

            {/* Botones Desplegables */}
            <div className={styles.barraOpciones}>

                {/* Boton para expandir filtros */}
                <button className={styles.botonExtendidos} type="button" onClick={() => setMostrarFiltros((valorActual) => !valorActual)}>
                    <span> Más filtros </span>
                    {mostrarFiltros ? (<KeyboardArrowUpIcon className={styles.iconoExpandir} />) : (<KeyboardArrowDownIcon className={styles.iconoExpandir} />)}
                </button>

                {/* Boton para expandir ordenamiento */}
                <button className={styles.botonExtendidos} type="button" onClick={() => setMostrarOrdenamiento((valorActual) => !valorActual)}>
                    <span> Ordenar por </span>
                    {mostrarOrdenamiento ? (<KeyboardArrowUpIcon className={styles.iconoExpandir} />) : (<KeyboardArrowDownIcon className={styles.iconoExpandir} />)}
                </button>
                
                {/* Opciones de Ordenamiento */}
                <div className={`${styles.listaOrdenamiento} ${mostrarOrdenamiento ? styles.listaOrdenamientoAbierta : ""}`}>
                    
                    {/* Sin Orden */}
                    <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "ninguno" ? styles.opcionOrdenamientoActiva : ""}`}
                        onClick={() => {
                            setOrden("ninguno");
                            setMostrarOrdenamiento(false);
                        }}
                    > Sin ordenar </button>
                    
                    {/* Precio Ascendente */}
                    <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "precioAsc" ? styles.opcionOrdenamientoActiva : ""}`}
                        onClick={() => {
                            setOrden("precioAsc");
                            setMostrarOrdenamiento(false);
                        }}
                    > Menor Precio </button>

                    {/* Precio Descendente */}
                    <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "precioDesc" ? styles.opcionOrdenamientoActiva : ""}`}
                        onClick={() => {
                            setOrden("precioDesc");
                            setMostrarOrdenamiento(false);
                        }}
                    > Mayor Precio </button>

                    {/* Alfabetico Ascendente */}
                    <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "alfabeticoAsc" ? styles.opcionOrdenamientoActiva : ""}`}
                        onClick={() => {
                            setOrden("alfabeticoAsc");
                            setMostrarOrdenamiento(false);
                        }}
                    > A-Z </button>

                    {/* Alfabetico Descendente */}
                    <button type="button" className={`${styles.opcionOrdenamiento} ${orden === "alfabeticoDesc" ? styles.opcionOrdenamientoActiva : ""}`}
                        onClick={() => {
                            setOrden("alfabeticoDesc");
                            setMostrarOrdenamiento(false);
                        }}
                    > Z-A </button>
                </div>
            </div>

            {/* Filtros extendidos */}
            <div className={`${styles.filtrosExtendidos} ${mostrarFiltros ? styles.filtrosExtendidosAbiertos : ""}`}>

                {/* Variedad */}
                <TextField select label="Variedad" value={variedadUnica ? "-" : variedad} onChange={(evento) => setVariedad(evento.target.value)} size="small" className={styles.selectMui} disabled={especie === "Todas" || variedadUnica}>
                    {!variedadUnica && (<MenuItem value="Todas" className={styles.opcionSelect}> Todas </MenuItem>)}
                    {variedades.map((opcion) => ( <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}> {opcion} </MenuItem>))}
                </TextField>

                {/* Presentacion */}
                <TextField select label="Presentación" value={presentacion} onChange={(evento) => setPresentacion(evento.target.value)} size="small" className={styles.selectMui} disabled={variedad === "Todas"}>
                    <MenuItem value="Todas" className={styles.opcionSelect}> Todas </MenuItem>
                    {presentaciones.map((opcion) => (<MenuItem key={opcion} value={opcion} className={styles.opcionSelect}> {opcion} </MenuItem>))}
                </TextField>

                {/* Categoria */}
                <TextField select label="Categoría" value={categoria} onChange={(evento) => setCategoria(evento.target.value)} size="small" className={styles.selectMui}>
                    <MenuItem value="Todas" className={styles.opcionSelect}> Todas </MenuItem>
                    {categorias.map((opcion) => (<MenuItem key={opcion} value={opcion} className={styles.opcionSelect}> {opcion} </MenuItem>))}
                </TextField>

                {/* Calibre */}
                <TextField select label="Calibre" value={calibre} onChange={(evento) => setCalibre(evento.target.value)} size="small" className={styles.selectMui}>
                    <MenuItem value="Todas" className={styles.opcionSelect}> Todos </MenuItem>
                    {calibres.map((opcion) => (<MenuItem key={opcion} value={opcion} className={styles.opcionSelect}> {opcion} </MenuItem>))}
                </TextField>
            </div>

            {/* Boton para limpiar filtros */}
            <div className={styles.pie}>
                <span className={styles.resultados}> {publicacionesFiltradas.length}{" "} {publicacionesFiltradas.length === 1 ? "publicación" : "publicaciones"}</span>
                <button type="button" className={styles.limpiar} onClick={limpiarFiltros}> Limpiar filtros </button>
            </div>
        </div>
    );
}
