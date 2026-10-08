"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { MenuItem, TextField } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import type { ProductoSeleccionado, HistoricoProducto, EspecieHistorica } from "./tipos";
import { fechaActualMontevideo } from "./parametros-consulta";
import styles from "./PreciosHistoricos.module.css";

type Props = {
    producto: ProductoSeleccionado;
    historico: HistoricoProducto | null;
    desde: string;
    hasta: string;
    error?: string;
    cargando?: boolean;
    especies?: EspecieHistorica[];
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

function formatoVolumen(valor: number | null | undefined): string {
    return valor == null ? "—" : `${formatoNumero(valor)} kg`;
}

function opciones(valores: string[], seleccionado: string) {
    return [...new Set(seleccionado ? [...valores, seleccionado] : valores)].sort(comparar);
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

export default function PreciosHistoricos({ producto, historico, desde, hasta, error, cargando = false, especies = [] }: Props) {
    const router = useRouter();
    const idProducto = identificadorEspecie(producto);
    const [pendiente, iniciarConsulta] = useTransition();
    const idCarga = useId();
    const cargandoTabla = cargando || pendiente;
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
        catalogo.set(idProducto, { id: idProducto, especie: producto.especie });
        return [...catalogo.values()].sort((a, b) => comparar(a.especie, b.especie));
    }, [especies, idProducto, producto.especie]);
    const especieSeleccionada = especiesDisponibles.find((especie) => especie.id === especieId) ?? producto;
    const especieConsulta = identificadorEspecie(especieSeleccionada);
    const cambioEspecie = especieId !== idProducto;
    const registros = useMemo(() => {
        if (!historico || error) return [];
        return historico.series
            .filter((dia) => dia.date >= desde && dia.date <= hasta)
            .sort((a, b) => b.date.localeCompare(a.date))
            .flatMap((dia) => dia.presentations.flatMap((presentacion) =>
                presentacion.prices.map((precio) => ({ dia, presentacion, precio }))));
    }, [historico, desde, hasta, error]);
    const disponibles = useMemo(() => {
        const presentaciones = historico && !error ? historico.series.flatMap((dia) => dia.presentations) : [];
        return {
            variedades: opciones(presentaciones.map((presentacion) => presentacion.variety), variedad),
            paises: opciones(presentaciones.map((presentacion) => presentacion.country), pais),
            categorias: opciones(presentaciones.flatMap((presentacion) => presentacion.prices.map((precio) => precio.category)), categoria),
            calibres: opciones(presentaciones.map((presentacion) => presentacion.caliber), calibre),
        };
    }, [historico, error, variedad, pais, categoria, calibre]);
    const variedadSeleccionada = variedad;
    const paisSeleccionado = pais;
    const categoriaSeleccionada = categoria;
    const calibreSeleccionado = calibre;
    const filas = useMemo(() => {
        return registros.filter(({ dia, presentacion, precio }) => {
            if (dia.date < periodoVisible.desde || dia.date > periodoVisible.hasta) return false;
            if (variedadSeleccionada && presentacion.variety !== variedadSeleccionada) return false;
            if (paisSeleccionado && presentacion.country !== paisSeleccionado) return false;
            if (categoriaSeleccionada && precio.category !== categoriaSeleccionada) return false;
            if (calibreSeleccionado && presentacion.caliber !== calibreSeleccionado) return false;
            return true;
        });
    }, [registros, periodoVisible, variedadSeleccionada, paisSeleccionado, categoriaSeleccionada, calibreSeleccionado]);
    const totalPaginas = Math.max(1, Math.ceil(filas.length / LIMITE));
    const paginaActual = Math.min(pagina, totalPaginas);
    const inicio = (paginaActual - 1) * LIMITE;
    const visibles = filas.slice(inicio, inicio + LIMITE);

    // La URL conserva el período y el producto aplicados hasta confirmar otra consulta.
    function urlConsulta(cambios: Record<string, string> = {}) {
        const parametros = {
            species_id: idProducto,
            producto: producto.especie,
            from: periodoVisible.desde,
            to: periodoVisible.hasta,
            variedad: variedadSeleccionada,
            pais: paisSeleccionado,
            calibre: calibreSeleccionado,
            categoria: categoriaSeleccionada,
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

    function cambiar(accion: () => void, cambios: Record<string, string>) {
        accion();
        setPagina(1);
        actualizarUrl(cambios);
    }

    function cambiarEspecie(id: string) {
        if (id === especieId) return;
        setEspecieId(id);
        setVariedad("");
        setPais("");
        setCategoria("");
        setCalibre("");
        setPagina(1);
        actualizarUrl({ variedad: "", pais: "", calibre: "", categoria: "" });
    }

    function limpiar() {
        setEspecieId(idProducto);
        setVariedad("");
        setPais("");
        setCategoria("");
        setCalibre("");
        setFechaDesde(desde);
        setFechaHasta(hasta);
        setPeriodoVisible({ desde, hasta });
        setPagina(1);
        actualizarUrl({ from: desde, to: hasta, variedad: "", pais: "", calibre: "", categoria: "" });
    }

    function consultar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (cargandoTabla || rangoInvalido || !fechaDesde || !fechaHasta) return;
        if (!cambioEspecie && fechaDesde >= desde && fechaHasta <= hasta && historico && !error) {
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
            <Link className={styles.volver} href="/precios-referencia">
                <ArrowBackIcon fontSize="small" /> Volver a precios de referencia
            </Link>
            <EncabezadoPagina titulo={`Histórico de ${producto.especie}`} cantidad={filas.length} subtitulo="registros históricos" />

            <section className={styles.filtrosPanel} aria-label="Filtros de precios históricos">
                <form action="/precios-historicos" method="get" aria-label="Consultar período histórico" onSubmit={consultar}>
                    <input type="hidden" name="species_id" value={especieConsulta} />
                    <input type="hidden" name="producto" value={especieSeleccionada.especie} />
                    <div className={styles.filtros}>
                        <TextField
                            className={`${styles.campo} ${styles.filtroEspecie}`}
                            select label="Especie" size="small" value={especieId} disabled={cargandoTabla}
                            onChange={(evento) => cambiarEspecie(evento.target.value)} slotProps={menu}
                        >
                            {especiesDisponibles.map((especie) => (
                                <MenuItem key={especie.id} value={especie.id} className={styles.opcionSelect}>{especie.especie}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            className={`${styles.campo} ${styles.filtroVariedad}`}
                            select label="Variedad" name="variedad" size="small" value={variedadSeleccionada} disabled={cargandoTabla}
                            onChange={(evento) => cambiar(() => setVariedad(evento.target.value), { variedad: evento.target.value })} slotProps={menu}
                        >
                            <MenuItem value="" className={styles.opcionSelect}>Todas las variedades</MenuItem>
                            {disponibles.variedades.map((valor) => (
                                <MenuItem key={valor} value={valor} className={styles.opcionSelect}>{valor}</MenuItem>
                            ))}
                        </TextField>
                        <button
                            type="button" className={styles.botonMasFiltros}
                            aria-expanded={mostrarFiltros} aria-controls={idFiltros}
                            onClick={() => setMostrarFiltros((abiertos) => !abiertos)}
                        >
                            Más filtros
                            {mostrarFiltros ? <KeyboardArrowUpIcon className={styles.iconoExpandir} /> : <KeyboardArrowDownIcon className={styles.iconoExpandir} />}
                        </button>
                        <div ref={panelFiltrosRef} id={idFiltros} className={`${styles.filtrosAdicionales} ${mostrarFiltros ? styles.filtrosAbiertos : ""}`}>
                            <div ref={contenidoFiltrosRef} className={styles.contenidoAdicional}>
                                <TextField
                                    className={`${styles.campo} ${styles.filtroPais}`}
                                    select label="País" name="pais" size="small" value={paisSeleccionado} disabled={cargandoTabla}
                                    onChange={(evento) => cambiar(() => setPais(evento.target.value), { pais: evento.target.value })} slotProps={menu}
                                >
                                    <MenuItem value="" className={styles.opcionSelect}>Todos los países</MenuItem>
                                    {disponibles.paises.map((valor) => (
                                        <MenuItem key={valor} value={valor} className={styles.opcionSelect}>{valor}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    className={`${styles.campo} ${styles.filtroCalibre}`}
                                    select label="Calibre" name="calibre" size="small" value={calibreSeleccionado} disabled={cargandoTabla}
                                    onChange={(evento) => cambiar(() => setCalibre(evento.target.value), { calibre: evento.target.value })} slotProps={menu}
                                >
                                    <MenuItem value="" className={styles.opcionSelect}>Todos los calibres</MenuItem>
                                    {disponibles.calibres.map((valor) => (
                                        <MenuItem key={valor} value={valor} className={styles.opcionSelect}>{valor}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    className={`${styles.campo} ${styles.filtroCategoria}`}
                                    select label="Categoría" name="categoria" size="small" value={categoriaSeleccionada} disabled={cargandoTabla}
                                    onChange={(evento) => cambiar(() => setCategoria(evento.target.value), { categoria: evento.target.value })} slotProps={menu}
                                >
                                    <MenuItem value="" className={styles.opcionSelect}>Todas las categorías</MenuItem>
                                    {disponibles.categorias.map((valor) => (
                                        <MenuItem key={valor} value={valor} className={styles.opcionSelect}>{valor}</MenuItem>
                                    ))}
                                </TextField>
                            </div>
                        </div>
                        <div className={styles.fechas}>
                            <TextField
                                className={`${styles.campo} ${styles.filtroDesde}`}
                                label="Desde" name="from" type="date" size="small" required
                                value={fechaDesde} disabled={cargandoTabla}
                                onChange={(evento) => setFechaDesde(evento.target.value)}
                                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: fechaHasta || hoy } }}
                            />
                            <TextField
                                className={`${styles.campo} ${styles.filtroHasta}`}
                                label="Hasta" name="to" type="date" size="small" required
                                value={fechaHasta} disabled={cargandoTabla} error={rangoInvalido}
                                onChange={(evento) => setFechaHasta(evento.target.value)}
                                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: fechaDesde || undefined, max: hoy } }}
                            />
                        </div>
                    </div>
                    <div className={styles.pieFiltros}>
                        <span className={styles.resultadosFiltros}>{filas.length} resultados</span>
                        <div className={styles.accionesFiltros}>
                            <button type="button" className={styles.limpiarFiltros} disabled={cargandoTabla} onClick={limpiar}>Limpiar filtros</button>
                            <button className={styles.consultar} type="submit" disabled={cargandoTabla || rangoInvalido || !fechaDesde || !fechaHasta}>Consultar</button>
                        </div>
                    </div>
                </form>
                {rangoInvalido && <p className={styles.vacio} role="alert">La fecha de inicio debe ser anterior o igual a la fecha de fin.</p>}
                {!cargandoTabla && !error && filas.length === 0 && <p className={styles.vacio} role="status">No hay registros históricos para la selección y el período indicados.</p>}
            </section>

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
                                    <div className={`${styles.carga} ${styles.errorCarga}`} role="alert">
                                        <WarningAmberIcon fontSize="large" />
                                        <p>{error}</p>
                                    </div>
                                </td></tr>
                            ) : visibles.map(({ dia, presentacion, precio }, indice) => (
                                <tr key={`${dia.date}-${presentacion.country}-${presentacion.caliber}-${precio.category}-${indice}`} className={precio.is_reference ? styles.filaReferencia : undefined}>
                                    <td>{formatoFecha.format(new Date(`${dia.date}T00:00:00Z`))}</td>
                                    <td>{presentacion.variety}</td><td>{presentacion.country}</td><td>{presentacion.caliber}</td><td>{precio.category}</td>
                                    <td className={styles.referencia}>{precio.is_reference && <span className={styles.insignia}>Referencia</span>}</td>
                                    <td className={styles.precio}>${formatoNumero(precio.min_kg)} - ${formatoNumero(precio.max_kg)}</td>
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
                        <div className={`${styles.carga} ${styles.errorCarga}`} role="alert">
                            <WarningAmberIcon fontSize="large" />
                            <p>{error}</p>
                        </div>
                    ) : visibles.map(({ dia, presentacion, precio }, indice) => {
                        const nombre = `${producto.especie} · ${presentacion.variety}`;
                        const atributos = `${presentacion.country} · Cal. ${presentacion.caliber} · Cat. ${precio.category}`;
                        const volumen = formatoVolumen(dia.volume_kg);
                        const precioKg = `$${formatoNumero(precio.min_kg)} - $${formatoNumero(precio.max_kg)} / kg`;
                        return (
                            <article className={`${styles.filaMobile} ${precio.is_reference ? styles.filaMobileReferencia : ""}`} key={`${dia.date}-${presentacion.country}-${presentacion.caliber}-${precio.category}-${indice}`}>
                                <header>
                                    <time dateTime={dia.date}>{formatoFecha.format(new Date(`${dia.date}T00:00:00Z`))}</time>
                                    <span className={styles.referenciaMobile} title={precio.is_reference ? "Referencia" : undefined}>{precio.is_reference && <span className={styles.insignia}>Referencia</span>}</span>
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
                {!cargandoTabla && filas.length > LIMITE && (
                    <nav className={styles.paginacion} aria-label="Páginas de precios históricos">
                        <span>{inicio + 1}-{Math.min(inicio + LIMITE, filas.length)} de {filas.length}</span>
                        <div>
                            <button type="button" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>Anterior</button>
                            <span>Página {paginaActual} de {totalPaginas}</span>
                            <button type="button" disabled={paginaActual === totalPaginas} onClick={() => setPagina(paginaActual + 1)}>Siguiente</button>
                        </div>
                    </nav>
                )}
            </section>
        </div>
    );
}
