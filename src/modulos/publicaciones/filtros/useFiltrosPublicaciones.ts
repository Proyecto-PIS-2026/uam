"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { compararEspeciesPorPrioridad } from "../../../compartido/prioridad-especies";
import type { PublicacionListado } from "../../consulta-mercado/consultas/consultas-publicaciones-operador";
import type { OpcionProducto } from "../../consulta-mercado/filtros/filtros-consulta";
import type { PublicacionFiltrable, FiltrosPublicacionesProps, OrdenPublicaciones } from "./tipos";
import { compararOpciones, compararPrecios, compararPublicacionesAlfabeticamente, compararPublicacionesPorPrioridad, compararPublicacionesOperador } from "./ordenar-publicaciones";

function normalizarTexto(texto: string) {
    return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function opcionesConSeleccion(valores: string[], seleccion: string, conservar: boolean) {
    const opciones = new Set(valores.filter(Boolean));
    if (conservar && seleccion !== "Todas") opciones.add(seleccion);
    return [...opciones];
}

export function useFiltrosPublicaciones<T extends PublicacionFiltrable>({publicaciones, especieFiltro, obtenerNombreFantasia, alFiltrar, alLimpiar, alCambiarEspecie, ordenInicial = "ninguno", alCambiarOrden, opcionesRemotas, navesDisponibles, totalRemoto, alConsultar, ordenamientoHabilitado = true, conservarSeleccionAlActualizar = false}: FiltrosPublicacionesProps<T>) {
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
    if (publicacionesAnteriores !== opciones && !conservarSeleccionAlActualizar) {
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
        const nombres = opcionesConSeleccion(opciones.map((publicacion) => publicacion.especie), especie, conservarSeleccionAlActualizar);
        return nombres.sort(compararEspeciesPorPrioridad);
    }, [opciones, especie, conservarSeleccionAlActualizar]);

    const naves = useMemo(() => {
        const disponibles = new Set(navesDisponibles ?? []);
        if (nave !== "Todas") disponibles.add(nave);
        return [...disponibles].sort(compararOpciones);
    }, [navesDisponibles, nave]);

    const variedades = useMemo(() => {
        let publicacionesBase = opciones;
        if (especie !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.especie === especie);

        return opcionesConSeleccion(publicacionesBase.map((publicacion) => publicacion.variedad), variedad, conservarSeleccionAlActualizar).sort(compararOpciones);
    }, [opciones, especie, variedad, conservarSeleccionAlActualizar]);

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
    const envases = useMemo(() => opcionesConSeleccion(opciones.map((publicacion) => publicacion.envase), envase, conservarSeleccionAlActualizar).sort(compararOpciones), [opciones, envase, conservarSeleccionAlActualizar]);
    const opcionesKilos = useMemo(() => opcionesConSeleccion(opciones.map((publicacion) => publicacion.kilos), kilos, conservarSeleccionAlActualizar)
        .sort((a, b) => a.localeCompare(b, "es", { numeric: true })), [opciones, kilos, conservarSeleccionAlActualizar]);

    const categorias = useMemo(() => {
        let publicacionesBase = publicacionesSegunJerarquia;

        if (calibre !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.calibre === calibre);

        return opcionesConSeleccion(publicacionesBase.map((publicacion) => publicacion.categoria), categoria, conservarSeleccionAlActualizar).sort(compararOpciones);
    }, [publicacionesSegunJerarquia, calibre, categoria, conservarSeleccionAlActualizar]);

    const calibres = useMemo(() => {
        let publicacionesBase = publicacionesSegunJerarquia;
        if (categoria !== "Todas") publicacionesBase = publicacionesBase.filter((publicacion) =>
            publicacion.categoria === categoria);

        return opcionesConSeleccion(publicacionesBase.map((publicacion) => publicacion.calibre), calibre, conservarSeleccionAlActualizar).sort(compararOpciones);
    }, [publicacionesSegunJerarquia, categoria, calibre, conservarSeleccionAlActualizar]);

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

    return {
        busqueda, setBusqueda, precioMinimo, setPrecioMinimo,
        precioMaximo, setPrecioMaximo, especie, variedad,
        envase, kilos, categoria, calibre,
        nave, setNave, mostrarFiltros, setMostrarFiltros,
        idFiltrosExtendidos, mostrarNave, especies, naves,
        variedades, envases, opcionesKilos, categorias,
        calibres, ordenElegido, cambiarOrden, variedadUnica,
        cantidadResultados, limpiarFiltros, rangoPrecioInvalido, manejarCambioEspecie,
        manejarCambioVariedad, manejarCambioEnvase, manejarCambioKilos, manejarCambioCategoria,
        manejarCambioCalibre,
    };
}
