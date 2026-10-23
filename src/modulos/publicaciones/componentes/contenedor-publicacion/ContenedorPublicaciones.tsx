"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
    const consulta = useRef<FiltrosConsulta>({ especie, orden: "prioridad", pagina: resultado.pagina });
    const ultimoPedido = useRef(0);
    const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
    const montado = useRef(true);
    const filtrosInicializados = useRef(false);
    const cargaEnCurso = useRef(false);
    const recargaPendiente = useRef(false);
    const origen = useRef(resultado);
    const invalidarPeticiones = useCallback(() => { ultimoPedido.current++; }, []);

    const cargar = useCallback(async function cargarActual(): Promise<void> {
        if (!montado.current) return;
        if (cargaEnCurso.current) {
            recargaPendiente.current = true;
            return;
        }
        cargaEnCurso.current = true;
        const pedido = ++ultimoPedido.current;
        setCargando(true);
        setError("");
        try {
            const respuesta = await obtenerPublicaciones({ ...consulta.current });
            if (!respuesta) throw new Error("No se pudieron cargar las publicaciones.");
            if (montado.current && pedido === ultimoPedido.current) {
                setDatos(respuesta);
                consulta.current.pagina = respuesta.pagina;
            }
        } catch {
            if (montado.current && pedido === ultimoPedido.current) setError("No se pudieron actualizar las publicaciones. Intentá nuevamente.");
        } finally {
            cargaEnCurso.current = false;
            if (montado.current && pedido === ultimoPedido.current) setCargando(false);
            if (recargaPendiente.current && montado.current) {
                recargaPendiente.current = false;
                void cargarActual();
            }
        }
    }, []);

    const programarCarga = useCallback(() => {
        if (temporizador.current) return;
        temporizador.current = setTimeout(() => { temporizador.current = null; void cargar(); }, 250);
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
        };
    }, [invalidarPeticiones]);

    const cambiarConsulta = useCallback((nuevaConsulta: FiltrosConsulta) => {
        consulta.current = { ...nuevaConsulta, pagina: 1 };
        if (!filtrosInicializados.current) {
            filtrosInicializados.current = true;
            return;
        }
        ultimoPedido.current++;
        setCargando(true);
        programarCarga();
    }, [programarCarga]);

    function cambiarPagina(pagina: number) {
        consulta.current.pagina = pagina;
        ultimoPedido.current++;
        if (temporizador.current) clearTimeout(temporizador.current);
        temporizador.current = null;
        void cargar();
    }

    function actualizarEspecieEnUrl(nuevaEspecie: string) {
        const url = new URL(window.location.href);
        if (nuevaEspecie === "Todas") url.searchParams.delete("especie");
        else url.searchParams.set("especie", nuevaEspecie);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }

    const paginas = Math.max(1, Math.ceil(datos.total / datos.tamanoPagina));

    return (
        <div className="secciones-pagina" aria-busy={cargando}>
            <FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreFantasia} publicaciones={publicacionesParaFiltros} opcionesRemotas={datos.opciones} totalRemoto={datos.total} especieFiltro={especie} ordenInicial="prioridad" alConsultar={cambiarConsulta} alCambiarEspecie={actualizarEspecieEnUrl} alLimpiar={() => actualizarEspecieEnUrl("Todas")} />
            {error && <p role="alert">{error} <button type="button" onClick={() => void cargar()}>Reintentar</button></p>}
            <ListadoPublicaciones publicaciones={datos.publicaciones} esAdmin={esAdmin} />
            <nav aria-label="Páginas de publicaciones" className="flex items-center justify-center gap-4">
                <button type="button" disabled={cargando || datos.pagina <= 1} onClick={() => cambiarPagina(datos.pagina - 1)} className="rounded-lg border border-border px-4 py-2 disabled:opacity-50">Anterior</button>
                <span role="status">Página {datos.pagina} de {paginas}</span>
                <button type="button" disabled={cargando || datos.pagina >= paginas} onClick={() => cambiarPagina(datos.pagina + 1)} className="rounded-lg border border-border px-4 py-2 disabled:opacity-50">Siguiente</button>
            </nav>
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
			<ListadoPublicaciones esAdmin={esAdmin} publicaciones={publicacionesFiltradas} />
		</div>
	);
}
