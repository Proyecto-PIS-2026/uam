"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import BotonVolver from "@/compartido/componentes/BotonVolver";
import BotonDesplegable from "@/compartido/componentes/BotonDesplegable";
import AvisoErrorToast from "@/compartido/componentes/AvisoErrorToast";
import Paginacion from "@/compartido/componentes/Paginacion";
import SelectorFecha from "@/compartido/componentes/SelectorFecha";
import PlaylistRemoveOutlinedIcon from "@mui/icons-material/PlaylistRemoveOutlined";
import { MenuItem, TextField } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import { useRouter } from "next/navigation";
import EncabezadoPagina from "@/compartido/componentes/EncabezadoPagina";
import { compararEspeciesPorPrioridad } from "@/compartido/prioridad-especies";
import { compararPaisesPorPrioridad } from "@/compartido/prioridad-paises";
import FuentePrecios from "../FuentePrecios";
import type { ProductoSeleccionado, HistoricoProducto, EspecieHistorica, OpcionesFiltrosHistoricos } from "./tipos";
import { esFechaISO, fechaActualMontevideo } from "./parametros-consulta";
import { textoValorHistorico } from "./valores-historicos";
import GraficaPreciosHistoricos from "./GraficaPreciosHistoricos";
import styles from "./PreciosHistoricos.module.css";

type Props = {
    producto: ProductoSeleccionado;
    historico: HistoricoProducto | null;
    desde: string;
    hasta: string;
    error?: string;
    cargando?: boolean;
    especies?: EspecieHistorica[];
    opcionesFiltros?: OpcionesFiltrosHistoricos;
};
const LIMITE = 40;
const comparar = new Intl.Collator("es", { sensitivity: "base", numeric: true }).compare;
const menu = { select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } } as const;
const formateadorNumero = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 2 });
const formatoFecha = new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

function formatoNumero(valor: number): string {
    return formateadorNumero.formatToParts(valor)
        .map((parte) => parte.type === "group" ? " " : parte.value)
        .join("");
}

function formatoPrecio(valor: unknown): string {
    return typeof valor === "number" ? formatoNumero(valor) : textoValorHistorico(valor);
}

function formatoVolumen(valor: unknown): string {
    return valor == null ? "—" : `${formatoPrecio(valor)} kg`;
}

function formatoFechaRegistro(valor: unknown): string {
    return esFechaISO(valor) ? formatoFecha.format(new Date(`${valor}T00:00:00Z`)) : textoValorHistorico(valor);
}

function opciones(valores: unknown[], seleccionado: string) {
    const textos = valores.map(textoValorHistorico);
    return [...new Set(seleccionado ? [...textos, seleccionado] : textos)].sort(comparar);
}

function identificadorEspecie(producto: Pick<ProductoSeleccionado, "id">): string {
    try {
        const valor: unknown = /^\d+$/.test(producto.id) ? producto.id : JSON.parse(producto.id);
        // Las selecciones anteriores guardaban [clasificación, especie].
        const id = Array.isArray(valor) && valor.length === 2 ? valor[1] : valor;
        if ((typeof id === "number" || typeof id === "string" && /^\d+$/.test(id))
            && Number.isSafeInteger(Number(id)) && Number(id) > 0) {
            return String(Number(id));
        }
    } catch {
        // Una selección sin identificador no puede consultar otro producto.
    }
    return "";
}

export default function PreciosHistoricos({ producto, historico, desde, hasta, error, cargando = false, especies = [], opcionesFiltros }: Props) {
    const router = useRouter();
    const idProducto = identificadorEspecie(producto);
    const [pendiente, iniciarConsulta] = useTransition();
    const idCarga = useId();
    const hoy = fechaActualMontevideo();
    const [fechaDesde, setFechaDesde] = useState(desde);
    const [fechaHasta, setFechaHasta] = useState(hasta);
    const [periodoVisible, setPeriodoVisible] = useState({ desde, hasta });
    const [especieId, setEspecieId] = useState(idProducto);
    const [variedad, setVariedad] = useState(producto.variedad);
    const [pais, setPais] = useState(producto.pais);
    const [categoria, setCategoria] = useState(producto.categoria);
    const [calibre, setCalibre] = useState(producto.calibre);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [pagina, setPagina] = useState(1);
    const panelFiltrosRef = useRef<HTMLDivElement>(null);
    const contenidoFiltrosRef = useRef<HTMLDivElement>(null);
    const idFiltros = useId();
    useEffect(() => {
        const url = new URL(window.location.href);
        if (!url.searchParams.has("classification_id")) return;
        url.searchParams.delete("classification_id");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }, []);
    useEffect(() => {
        if (!idProducto || cargando) return;
        function restaurarSeleccion() {
            const parametros = new URL(window.location.href).searchParams;
            if (identificadorEspecie({ id: parametros.get("species_id") ?? "" }) !== idProducto) return;
            setEspecieId(idProducto);
            setVariedad(parametros.get("variedad") ?? "");
            setPais(parametros.get("pais") ?? "");
            setCategoria(parametros.get("categoria") ?? "");
            setCalibre(parametros.get("calibre") ?? "");
            const desdeUrl = parametros.get("from") ?? desde;
            const hastaUrl = parametros.get("to") ?? hasta;
            if (esFechaISO(desdeUrl) && esFechaISO(hastaUrl) && desdeUrl <= hastaUrl
                && desdeUrl >= desde && hastaUrl <= hasta) {
                setFechaDesde(desdeUrl);
                setFechaHasta(hastaUrl);
                setPeriodoVisible((actual) => actual.desde === desdeUrl && actual.hasta === hastaUrl
                    ? actual : { desde: desdeUrl, hasta: hastaUrl });
            }
            setPagina(1);
        }
        // Al volver, Next puede restaurar datos cargados antes de cambiar los filtros locales.
        restaurarSeleccion();
        window.addEventListener("popstate", restaurarSeleccion);
        return () => window.removeEventListener("popstate", restaurarSeleccion);
    }, [idProducto, desde, hasta, cargando]);
    useLayoutEffect(() => {
        const panel = panelFiltrosRef.current;
        const contenido = contenidoFiltrosRef.current;
        if (!panel || !contenido) return;
        const actualizarAltura = () => panel.style.setProperty("--altura-filtros", `${contenido.scrollHeight}px`);
        actualizarAltura();
        window.addEventListener("resize", actualizarAltura);
        const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(actualizarAltura);
        observador?.observe(contenido);
        return () => {
            window.removeEventListener("resize", actualizarAltura);
            observador?.disconnect();
        };
    }, []);
    const rangoInvalido = fechaDesde > fechaHasta;
    const especiesDisponibles = useMemo(() => {
        const catalogo = new Map(especies.map((especie) => {
            const id = identificadorEspecie(especie);
            return [id, { ...especie, id }] as const;
        }));
        if (idProducto) catalogo.set(idProducto, { id: idProducto, especie: producto.especie });
        return [...catalogo.values()].sort((a, b) => compararEspeciesPorPrioridad(a.especie, b.especie));
    }, [especies, idProducto, producto.especie]);
    const especieSeleccionada = especiesDisponibles.find((especie) => especie.id === especieId) ?? producto;
    const especieConsulta = identificadorEspecie(especieSeleccionada);
    const mensajeSinSeleccion = especiesDisponibles.length > 0
        ? "Seleccioná una especie para consultar su histórico de precios."
        : "No hay especies disponibles para consultar el histórico. Podés volver a precios de referencia.";
    const cambioEspecie = especieId !== idProducto;
    const cargandoTabla = cargando || pendiente || cambioEspecie;
    const validarFiltros = historico !== null && !error && !cargandoTabla;
    const registros = useMemo(() => {
        if (!historico || error || cambioEspecie) return [];
        return historico.series
            .filter((dia) => !esFechaISO(dia.date) || dia.date >= desde && dia.date <= hasta)
            .sort((a, b) => textoValorHistorico(b.date).localeCompare(textoValorHistorico(a.date)))
            .flatMap((dia) => dia.presentations.flatMap((presentacion) =>
                presentacion.prices.map((precio) => ({ dia, presentacion, precio }))));
    }, [historico, desde, hasta, error, cambioEspecie]);
    const registrosDelPeriodo = useMemo(() => registros.filter(({ dia }) =>
        !esFechaISO(dia.date) || dia.date >= periodoVisible.desde && dia.date <= periodoVisible.hasta),
    [registros, periodoVisible]);
    const disponibles = useMemo(() => {
        if (cambioEspecie) return { variedades: [], paises: [], categorias: [], calibres: [] };
        const alternativas = historico && !error ? undefined : opcionesFiltros;
        return {
            variedades: opciones(alternativas?.variedades ?? registrosDelPeriodo.map(({ presentacion }) => presentacion.variety), validarFiltros ? "" : variedad),
            paises: opciones(alternativas?.paises ?? registrosDelPeriodo.map(({ presentacion }) => presentacion.country), validarFiltros ? "" : pais).sort(compararPaisesPorPrioridad),
            categorias: opciones(alternativas?.categorias ?? registrosDelPeriodo.map(({ precio }) => precio.category), validarFiltros ? "" : categoria),
            calibres: opciones(alternativas?.calibres ?? registrosDelPeriodo.map(({ presentacion }) => presentacion.caliber), validarFiltros ? "" : calibre),
        };
    }, [historico, opcionesFiltros, registrosDelPeriodo, validarFiltros, error, cambioEspecie, variedad, pais, categoria, calibre]);
    const variedadAplicada = validarFiltros && !disponibles.variedades.includes(variedad) ? "" : variedad;
    const paisAplicado = validarFiltros && !disponibles.paises.includes(pais) ? "" : pais;
    const categoriaAplicada = validarFiltros && !disponibles.categorias.includes(categoria) ? "" : categoria;
    const calibreAplicado = validarFiltros && !disponibles.calibres.includes(calibre) ? "" : calibre;
    useEffect(() => {
        if (!validarFiltros) return;
        const url = new URL(window.location.href);
        const mismaEspecie = identificadorEspecie({ id: url.searchParams.get("species_id") ?? "" }) === idProducto;
        let cambioUrl = false;
        for (const [nombre, anterior, aplicado, actualizar] of [
            ["variedad", variedad, variedadAplicada, setVariedad],
            ["pais", pais, paisAplicado, setPais],
            ["categoria", categoria, categoriaAplicada, setCategoria],
            ["calibre", calibre, calibreAplicado, setCalibre],
        ] as const) {
            if (anterior === aplicado) continue;
            actualizar((actual) => actual === anterior ? aplicado : actual);
            if (mismaEspecie && url.searchParams.get(nombre) === anterior) {
                url.searchParams.delete(nombre);
                cambioUrl = true;
            }
        }
        if (cambioUrl) window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }, [validarFiltros, idProducto, variedad, variedadAplicada, pais, paisAplicado, categoria, categoriaAplicada, calibre, calibreAplicado]);
    const filas = useMemo(() => {
        return registrosDelPeriodo.filter(({ presentacion, precio }) => {
            if (variedadAplicada && textoValorHistorico(presentacion.variety) !== variedadAplicada) return false;
            if (paisAplicado && textoValorHistorico(presentacion.country) !== paisAplicado) return false;
            if (categoriaAplicada && textoValorHistorico(precio.category) !== categoriaAplicada) return false;
            if (calibreAplicado && textoValorHistorico(presentacion.caliber) !== calibreAplicado) return false;
            return true;
        });
    }, [registrosDelPeriodo, variedadAplicada, paisAplicado, categoriaAplicada, calibreAplicado]);
    const totalPaginas = Math.max(1, Math.ceil(filas.length / LIMITE));
    const paginaActual = Math.min(pagina, totalPaginas);
    const inicio = (paginaActual - 1) * LIMITE;
    const visibles = filas.slice(inicio, inicio + LIMITE);

    // Las fechas se aplican al consultar; los atributos se aplican al seleccionarlos.
    function urlConsulta(cambios: Record<string, string> = {}) {
        const parametros = {
            species_id: idProducto,
            producto: producto.especie,
            from: periodoVisible.desde,
            to: periodoVisible.hasta,
            variedad: variedadAplicada,
            pais: paisAplicado,
            calibre: calibreAplicado,
            categoria: categoriaAplicada,
            ...cambios,
        };
        const url = new URL(window.location.href);
        url.pathname = "/precios-historicos";
        url.searchParams.delete("classification_id");
        for (const [nombre, valor] of Object.entries(parametros)) {
            if (valor) url.searchParams.set(nombre, valor);
            else url.searchParams.delete(nombre);
        }
        return `${url.pathname}${url.search}${url.hash}`;
    }

    function actualizarUrl(cambios: Record<string, string> = {}) {
        window.history.replaceState(null, "", urlConsulta(cambios));
    }

    function cambiarFiltro(accion: () => void, cambios: Record<string, string>) {
        accion();
        setPagina(1);
        actualizarUrl(cambios);
    }

    function cambiarEspecie(id: string) {
        if (id === especieId) return;
        const especie = especiesDisponibles.find((opcion) => opcion.id === id);
        if (!especie) return;
        setEspecieId(id);
        setVariedad("");
        setPais("");
        setCategoria("");
        setCalibre("");
        setPagina(1);
        iniciarConsulta(() => router.push(urlConsulta({
            species_id: id,
            producto: especie.especie,
            variedad: "", pais: "", calibre: "", categoria: "",
        }), { scroll: false }));
    }

    function limpiar() {
        setVariedad("");
        setPais("");
        setCategoria("");
        setCalibre("");
        setFechaDesde(desde);
        setFechaHasta(hasta);
        setPeriodoVisible({ desde, hasta });
        setPagina(1);
        if (idProducto) actualizarUrl({ from: desde, to: hasta, variedad: "", pais: "", calibre: "", categoria: "" });
    }

    function consultar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (cargandoTabla || rangoInvalido || !fechaDesde || !fechaHasta || !especieConsulta) return;
        if (fechaDesde >= desde && fechaHasta <= hasta && historico && historico.series.length > 0 && !error
            && fechaDesde >= historico.from && fechaHasta <= historico.to) {
            setPeriodoVisible({ desde: fechaDesde, hasta: fechaHasta });
            setPagina(1);
            actualizarUrl({ from: fechaDesde, to: fechaHasta });
            return;
        }
        const parametros: Record<string, string> = {};
        for (const [nombre, valor] of new FormData(evento.currentTarget)) {
            if (typeof valor === "string") parametros[nombre] = valor;
        }
        const url = urlConsulta(parametros);
        setPagina(1);
        iniciarConsulta(() => {
            router.push(url, { scroll: false });
        });
    }

    return (
        <div className={styles.pagina}>
            <BotonVolver href="/precios-referencia">Volver a precios de referencia</BotonVolver>
            <EncabezadoPagina titulo={idProducto ? `Histórico de ${producto.especie}` : "Histórico de precios"} cantidad={filas.length} subtitulo={filas.length === 1 ? "registro histórico" : "registros históricos"} />

            <section className={styles.filtrosPanel} aria-label="Filtros de precios históricos">
                <form action="/precios-historicos" method="get" aria-label="Consultar período histórico" onSubmit={consultar}>
                    <input type="hidden" name="species_id" value={especieConsulta} />
                    <input type="hidden" name="producto" value={especieSeleccionada.especie} />
                    <div className={styles.filtros}>
                        <TextField
                            className={`${styles.campo} ${styles.filtroEspecie}`}
                            select label="Especie" size="small" value={especieId} disabled={cargandoTabla || especiesDisponibles.length === 0}
                            onChange={(evento) => cambiarEspecie(evento.target.value)} slotProps={menu}
                        >
                            {!idProducto && <MenuItem value="" disabled>Seleccioná una especie</MenuItem>}
                            {especiesDisponibles.map((especie) => (
                                <MenuItem key={especie.id} value={especie.id} className={styles.opcionSelect}>{especie.especie}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            className={`${styles.campo} ${styles.filtroVariedad}`}
                            select label="Variedad" name="variedad" size="small" value={variedadAplicada} disabled={cargandoTabla || !especieConsulta}
                            onChange={(evento) => cambiarFiltro(() => setVariedad(evento.target.value), { variedad: evento.target.value })} slotProps={menu}
                        >
                            <MenuItem value="" className={styles.opcionSelect}>Todas las variedades</MenuItem>
                            {disponibles.variedades.map((valor) => (
                                <MenuItem key={valor} value={valor} className={styles.opcionSelect}>{valor}</MenuItem>
                            ))}
                        </TextField>
                        <BotonDesplegable
                            className={styles.botonMasFiltros}
                            abierto={mostrarFiltros} aria-controls={idFiltros}
                            onClick={() => setMostrarFiltros((abiertos) => !abiertos)}
                        >
                            Más filtros
                        </BotonDesplegable>
                        <div ref={panelFiltrosRef} id={idFiltros} className={`${styles.filtrosAdicionales} ${mostrarFiltros ? styles.filtrosAbiertos : ""}`}>
                            <div ref={contenidoFiltrosRef} className={styles.contenidoAdicional}>
                                <TextField
                                    className={`${styles.campo} ${styles.filtroPais}`}
                                    select label="País" name="pais" size="small" value={paisAplicado} disabled={cargandoTabla || !especieConsulta}
                                    onChange={(evento) => cambiarFiltro(() => setPais(evento.target.value), { pais: evento.target.value })} slotProps={menu}
                                >
                                    <MenuItem value="" className={styles.opcionSelect}>Todos los países</MenuItem>
                                    {disponibles.paises.map((valor) => (
                                        <MenuItem key={valor} value={valor} className={styles.opcionSelect}>{valor}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    className={`${styles.campo} ${styles.filtroCalibre}`}
                                    select label="Calibre" name="calibre" size="small" value={calibreAplicado} disabled={cargandoTabla || !especieConsulta}
                                    onChange={(evento) => cambiarFiltro(() => setCalibre(evento.target.value), { calibre: evento.target.value })} slotProps={menu}
                                >
                                    <MenuItem value="" className={styles.opcionSelect}>Todos los calibres</MenuItem>
                                    {disponibles.calibres.map((valor) => (
                                        <MenuItem key={valor} value={valor} className={styles.opcionSelect}>{valor}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    className={`${styles.campo} ${styles.filtroCategoria}`}
                                    select label="Categoría" name="categoria" size="small" value={categoriaAplicada} disabled={cargandoTabla || !especieConsulta}
                                    onChange={(evento) => cambiarFiltro(() => setCategoria(evento.target.value), { categoria: evento.target.value })} slotProps={menu}
                                >
                                    <MenuItem value="" className={styles.opcionSelect}>Todas las categorías</MenuItem>
                                    {disponibles.categorias.map((valor) => (
                                        <MenuItem key={valor} value={valor} className={styles.opcionSelect}>{valor}</MenuItem>
                                    ))}
                                </TextField>
                            </div>
                        </div>
                        <div className={styles.fechas}>
                            <SelectorFecha
                                className={`${styles.campo} ${styles.filtroDesde}`}
                                label="Desde" name="from" required
                                value={fechaDesde} disabled={cargandoTabla}
                                onChange={setFechaDesde}
                                max={fechaHasta || hoy}
                            />
                            <SelectorFecha
                                className={`${styles.campo} ${styles.filtroHasta}`}
                                label="Hasta" name="to" required
                                value={fechaHasta} disabled={cargandoTabla} error={rangoInvalido}
                                onChange={setFechaHasta}
                                min={fechaDesde || undefined} max={hoy}
                            />
                        </div>
                    </div>
                    <div className={styles.pieFiltros}>
                        <span className={styles.resultadosFiltros}>{filas.length} resultados</span>
                        <div className={styles.accionesFiltros}>
                            <button type="button" className={styles.limpiarFiltros} disabled={cargandoTabla} onClick={limpiar}>Limpiar filtros</button>
                            <button className={styles.consultar} type="submit" disabled={cargandoTabla || rangoInvalido || !fechaDesde || !fechaHasta || !especieConsulta}>Consultar</button>
                        </div>
                    </div>
                </form>
                <AvisoErrorToast mensaje={rangoInvalido ? "La fecha de inicio debe ser anterior o igual a la fecha de fin." : null} />
            </section>

            <AvisoErrorToast mensaje={cargandoTabla ? null : error} cerrarAlCorregir={false} />
            <GraficaPreciosHistoricos
                registros={filas}
                desde={periodoVisible.desde}
                hasta={periodoVisible.hasta}
                producto={producto.especie}
                cargando={cargandoTabla}
                error={Boolean(error)}
            />

            <section className={styles.tablaPanel} aria-label={`Histórico de ${producto.especie}`}>
                <div className={styles.tablaCabecera}><h2>Histórico de precios</h2></div>
                <div className={styles.tablaContenedor}>
                    <table className={styles.tabla} aria-busy={cargandoTabla} aria-describedby={cargandoTabla ? `${idCarga}-tabla` : undefined}>
                        <thead><tr>
                            <th scope="col">Fecha</th><th scope="col">Variedad</th><th scope="col">País</th>
                            <th scope="col">Calibre</th><th scope="col">Categoría</th><th scope="col">Referencia</th><th scope="col">Precio por kg</th><th scope="col">Volumen</th>
                        </tr></thead>
                        <tbody>
                            {cargandoTabla ? (
                                <tr><td colSpan={8}>
                                    <div className={styles.carga}>
                                        <CircularProgress id={`${idCarga}-tabla`} size={36} color="inherit" aria-label="Cargando precios históricos" />
                                    </div>
                                </td></tr>
                            ) : error ? (
                                <tr><td colSpan={8}>
                                    <div className={styles.carga}>
                                        <p>Consultá nuevamente para ver los precios.</p>
                                    </div>
                                </td></tr>
                            ) : visibles.map(({ dia, presentacion, precio }, indice) => (
                                <tr key={`${textoValorHistorico(dia.date)}-${textoValorHistorico(presentacion.country)}-${textoValorHistorico(presentacion.caliber)}-${textoValorHistorico(precio.category)}-${indice}`} className={precio.is_reference === true ? styles.filaReferencia : undefined}>
                                    <td>{formatoFechaRegistro(dia.date)}</td>
                                    <td>{textoValorHistorico(presentacion.variety)}</td><td>{textoValorHistorico(presentacion.country)}</td><td>{textoValorHistorico(presentacion.caliber)}</td><td>{textoValorHistorico(precio.category)}</td>
                                    <td className={styles.referencia}>{precio.is_reference === true ? <span className={styles.insignia}>Referencia</span> : precio.is_reference === false ? "" : textoValorHistorico(precio.is_reference)}</td>
                                    <td className={styles.precio}>${formatoPrecio(precio.min_kg)} - ${formatoPrecio(precio.max_kg)}</td>
                                    <td>{formatoVolumen(dia.volume_kg)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.listaMobile} aria-busy={cargandoTabla} aria-describedby={cargandoTabla ? `${idCarga}-mobile` : undefined}>
                    {cargandoTabla ? (
                        <div className={styles.carga}>
                            <CircularProgress id={`${idCarga}-mobile`} size={36} color="inherit" aria-label="Cargando precios históricos" />
                        </div>
                    ) : error ? (
                        <div className={styles.carga}>
                            <p>Consultá nuevamente para ver los precios.</p>
                        </div>
                    ) : visibles.map(({ dia, presentacion, precio }, indice) => {
                        const nombre = `${producto.especie} · ${textoValorHistorico(presentacion.variety)}`;
                        const atributos = `${textoValorHistorico(presentacion.country)} · Cal. ${textoValorHistorico(presentacion.caliber)} · Cat. ${textoValorHistorico(precio.category)}`;
                        const volumen = formatoVolumen(dia.volume_kg);
                        const precioKg = `$${formatoPrecio(precio.min_kg)} - $${formatoPrecio(precio.max_kg)} / kg`;
                        return (
                            <article className={`${styles.filaMobile} ${precio.is_reference === true ? styles.filaMobileReferencia : ""}`} key={`${textoValorHistorico(dia.date)}-${textoValorHistorico(presentacion.country)}-${textoValorHistorico(presentacion.caliber)}-${textoValorHistorico(precio.category)}-${indice}`}>
                                <header>
                                    <time dateTime={textoValorHistorico(dia.date)}>{formatoFechaRegistro(dia.date)}</time>
                                    <span className={styles.referenciaMobile} title={precio.is_reference === true ? "Referencia" : precio.is_reference === false ? undefined : textoValorHistorico(precio.is_reference)}>{precio.is_reference === true ? <span className={styles.insignia}>Referencia</span> : precio.is_reference === false ? "" : textoValorHistorico(precio.is_reference)}</span>
                                    <strong className={styles.precioMobile} title={precioKg}>{precioKg}</strong>
                                </header>
                                <p className={styles.nombreProductoMobile} title={nombre}>{nombre}</p>
                                <div className={styles.filaMobileDetalles}>
                                    <p className={styles.atributosProductoMobile} title={atributos}>{atributos}</p>
                                    <span className={styles.volumen} aria-label={`Volumen: ${volumen}`}>{volumen}</span>
                                </div>
                            </article>
                        );
                    })}
                </div>
                {!cargandoTabla && !error && filas.length === 0 && (
                    <div className={styles.estadoVacio} role="status">
                        <PlaylistRemoveOutlinedIcon className={styles.iconoVacio} aria-hidden="true" />
                        <p>{idProducto ? "No hay registros históricos para los filtros y el período seleccionados." : mensajeSinSeleccion}</p>
                    </div>
                )}
                {!cargandoTabla && filas.length > LIMITE && (
                    <Paginacion
                        pagina={paginaActual}
                        totalPaginas={totalPaginas}
                        alCambiar={setPagina}
                        etiqueta="Páginas de precios históricos"
                        resumen={`${inicio + 1}-${Math.min(inicio + LIMITE, filas.length)} de ${filas.length}`}
                    />
                )}
            </section>
            <FuentePrecios />
        </div>
    );
}
