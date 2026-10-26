"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ShoppingBasketOutlinedIcon from "@mui/icons-material/ShoppingBasketOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import YardOutlinedIcon from "@mui/icons-material/YardOutlined";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import type { ResultadoPublicaciones } from "../../../consulta-mercado/acciones/PublicacionesOperador";
import type { FiltrosConsulta } from "../../../consulta-mercado/acciones/filtros-consulta";
import obtenerPublicaciones from "../../../consulta-mercado/acciones/ConsultarPublicacionOperador.action";
import FiltrosPublicaciones, { compararPublicacionesPorPrioridad } from "../../filtros/FiltrosPublicaciones";
import ListadoPublicaciones from "../listado-publicaciones/ListadoPublicaciones";
import { useActualizacionesPublicaciones } from "../../tiempo-real/use-actualizaciones-publicaciones";

import type { PublicacionListado } from "../../../consulta-mercado/acciones/PublicacionesOperador";
import type { PublicacionProductorListado } from "../../../consulta-mercado/acciones/PublicacionesProductor";

type Publicacion = PublicacionListado | PublicacionProductorListado;
const obtenerNombreFantasia = (publicacion: Publicacion) => publicacion.tipoPublicacion === "OPERADOR" ? publicacion.operador.nombreFantasia : publicacion.productor.nombreFantasia;

type PropiedadesLocales = {
    publicaciones: Publicacion[];
    especie?: string;
    esAdmin?: boolean;
};

export default function ContenedorPublicaciones(props: PropiedadesRemotas | PropiedadesLocales) {
    if ("resultado" in props) return <ContenidoRemoto {...props} />;
    const especie = props.especie && props.publicaciones.some((publicacion) => publicacion.especie === props.especie) ? props.especie : "";
    return <ContenidoLocal key={especie} {...props} especie={especie} />;
}

type PropiedadesRemotas = {
    resultado: ResultadoPublicaciones;
    especie?: string;
    esAdmin?: boolean;
};

const publicacionesParaFiltros: [] = [];

function ContenidoRemoto({ resultado, especie = "", esAdmin = false }: PropiedadesRemotas) {
    const [datos, setDatos] = useState(resultado);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState("");
    const consulta = useRef<FiltrosConsulta>({ especie, orden: "prioridad" });
    const ultimoPedido = useRef(0);
    const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
    const montado = useRef(true);
    const filtrosInicializados = useRef(false);
    const cargaEnCurso = useRef(false);
    const recargaPendiente = useRef(false);
    const esperasDeCarga = useRef<Array<(actualizado: boolean) => void>>([]);
    const origen = useRef(resultado);
    const invalidarPeticiones = useCallback(() => { ultimoPedido.current++; }, []);

    const cargar = useCallback(async function cargarActual(): Promise<void> {
        if (!montado.current) return;
        if (cargaEnCurso.current) {
            recargaPendiente.current = true;
            return;
        }
        cargaEnCurso.current = true;
        if (temporizador.current) {
            clearTimeout(temporizador.current);
            temporizador.current = null;
        }
        const esperas = esperasDeCarga.current;
        esperasDeCarga.current = [];
        let actualizado = false;
        const pedido = ++ultimoPedido.current;
        setCargando(true);
        setError("");
        try {
            const respuesta = await obtenerPublicaciones({ ...consulta.current });
            if (!respuesta) throw new Error("No se pudieron cargar las publicaciones.");
            if (montado.current && pedido === ultimoPedido.current) {
                setDatos(respuesta);
                actualizado = true;
            }
        } catch {
            if (montado.current && pedido === ultimoPedido.current) setError("No se pudieron actualizar las publicaciones. Intentá nuevamente.");
        } finally {
            cargaEnCurso.current = false;
            if (montado.current && pedido === ultimoPedido.current) setCargando(false);
            if (montado.current && pedido !== ultimoPedido.current && (recargaPendiente.current || temporizador.current)) {
                esperasDeCarga.current.push(...esperas);
            } else {
                for (const resolver of esperas) resolver(actualizado);
            }
            if (recargaPendiente.current && montado.current) {
                recargaPendiente.current = false;
                void cargarActual();
            }
        }
    }, []);

    const programarCarga = useCallback(() => {
        if (!montado.current) return Promise.resolve(false);
        const finalizacion = new Promise<boolean>((resolver) => esperasDeCarga.current.push(resolver));
        if (!temporizador.current) {
            temporizador.current = setTimeout(() => { temporizador.current = null; void cargar(); }, 250);
        }
        return finalizacion;
    }, [cargar]);

    useActualizacionesPublicaciones(programarCarga);

    useEffect(() => {
        if (origen.current !== resultado) {
            origen.current = resultado;
            programarCarga();
        }
    }, [resultado, programarCarga]);

    useEffect(() => {
        montado.current = true;
        return () => {
            montado.current = false;
            invalidarPeticiones();
            if (temporizador.current) clearTimeout(temporizador.current);
            temporizador.current = null;
            for (const resolver of esperasDeCarga.current) resolver(false);
            esperasDeCarga.current = [];
        };
    }, [invalidarPeticiones]);

    const cambiarConsulta = useCallback((nuevaConsulta: FiltrosConsulta) => {
        consulta.current = { ...nuevaConsulta };
        if (!filtrosInicializados.current) {
            filtrosInicializados.current = true;
            return;
        }
        ultimoPedido.current++;
        setCargando(true);
        programarCarga();
    }, [programarCarga]);

    function actualizarEspecieEnUrl(nuevaEspecie: string) {
        const url = new URL(window.location.href);
        if (nuevaEspecie === "Todas") url.searchParams.delete("especie");
        else url.searchParams.set("especie", nuevaEspecie);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }

    return (
        <div className="secciones-pagina" aria-busy={cargando}>
            <FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreFantasia} publicaciones={publicacionesParaFiltros} opcionesRemotas={datos.opciones} navesDisponibles={datos.naves} totalRemoto={datos.total} especieFiltro={especie} ordenInicial="prioridad" alConsultar={cambiarConsulta} alCambiarEspecie={actualizarEspecieEnUrl} alLimpiar={() => actualizarEspecieEnUrl("Todas")} />
            {error && <p role="alert">{error} <button type="button" onClick={() => void cargar()}>Reintentar</button></p>}
            <ListadoPublicaciones
                publicaciones={datos.publicaciones}
                esAdmin={esAdmin}
                estadoVacio={
                    <EstadoVacio
                        titulo={datos.totalCatalogo === 0 ? "Todavía no hay publicaciones disponibles" : "No hay publicaciones que coincidan con la búsqueda."}
                        descripcion={datos.totalCatalogo === 0 ? "Los productos de los operadores aparecerán aquí cuando estén disponibles." : "Probá cambiando o limpiando los filtros para ver otros productos."}
                        icono={datos.totalCatalogo === 0 ? <ShoppingBasketOutlinedIcon /> : <SearchOffOutlinedIcon />}
                    />
                }
            />
        </div>
    );
}

function ContenidoLocal({publicaciones, especie = "", esAdmin = false}: PropiedadesLocales) {
	const [publicacionesFiltradas, setPublicacionesFiltradas] = useState(() => {
		const iniciales = especie ? publicaciones.filter((publicacion) => publicacion.especie === especie) : [...publicaciones];
		return iniciales.sort(compararPublicacionesPorPrioridad);
	});

	function actualizarEspecieEnUrl(nuevaEspecie: string) {
		const url = new URL(window.location.href);
		if (nuevaEspecie === "Todas") url.searchParams.delete("especie");
		else url.searchParams.set("especie", nuevaEspecie);
		window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
	}

	return (
		<div className="secciones-pagina">
			<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreFantasia} publicaciones={publicaciones} especieFiltro={especie} ordenInicial="prioridad" alFiltrar={setPublicacionesFiltradas} alCambiarEspecie={actualizarEspecieEnUrl} alLimpiar={() => actualizarEspecieEnUrl("Todas")}/>
			<ListadoPublicaciones
				esAdmin={esAdmin}
				publicaciones={publicacionesFiltradas}
				estadoVacio={
					<EstadoVacio
						titulo={publicaciones.length === 0 ? "Todavía no hay publicaciones disponibles" : "No hay publicaciones que coincidan con la búsqueda."}
						descripcion={publicaciones.length === 0 ? "Los productos de los productores aparecerán aquí cuando estén disponibles." : "Probá cambiando o limpiando los filtros para ver otros productos."}
						icono={publicaciones.length === 0 ? <YardOutlinedIcon /> : <SearchOffOutlinedIcon />}
					/>
				}
			/>
		</div>
	);
}
