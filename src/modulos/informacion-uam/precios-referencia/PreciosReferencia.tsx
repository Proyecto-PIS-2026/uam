"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { MenuItem, TextField } from "@mui/material";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import type { PrecioReferencia } from "@/modulos/informacion-uam/precios-referencia/consultas-precios-referencia";
import styles from "./PreciosReferencia.module.css";

type Props = { fechaRelevamiento: string; filas: PrecioReferencia[] };
type SeleccionFiltros = Pick<PrecioReferencia, "especie" | "variedad" | "unidad" | "pais" | "categoria" | "calibre">;
type CampoFiltro = keyof SeleccionFiltros;
const FILTROS_VACIOS: SeleccionFiltros = { especie: "", variedad: "", unidad: "", pais: "", categoria: "", calibre: "" };
const LIMITE = 40;
const comparar = new Intl.Collator("es", { sensitivity: "base", numeric: true }).compare;
const formato = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 2 });
const menu = { select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } } as const;

function normalizar(valor: string) {
    return valor.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function rango(minimo: number, maximo: number) {
    const inicio = formato.format(minimo);
    const fin = formato.format(maximo);
    return inicio === fin ? `$${inicio}` : `$${inicio} - ${fin}`;
}

function opciones(valores: string[]) {
    return [...new Set(valores)].sort(comparar);
}

function filasCompatibles(filas: PrecioReferencia[], seleccion: SeleccionFiltros, omitir: CampoFiltro[] = []) {
    return filas.filter((fila) => {
        for (const campo of Object.keys(seleccion) as CampoFiltro[]) {
            if (omitir.includes(campo)) continue;
            if (seleccion[campo] && fila[campo] !== seleccion[campo]) return false;
        }
        return true;
    });
}

function ajustarSeleccion(filas: PrecioReferencia[], seleccion: SeleccionFiltros, campoCambiado: CampoFiltro) {
    const ajustada = { ...seleccion };
    const orden: CampoFiltro[] = campoCambiado === "especie"
        ? ["especie", "pais", "categoria", "calibre", "variedad", "unidad"]
        : ["especie", "variedad", "unidad", "pais", "categoria", "calibre"];
    let compatibles = filas;

    for (const campo of orden) {
        const valor = ajustada[campo];
        if (!valor) continue;
        if (!compatibles.some((fila) => fila[campo] === valor)) {
            ajustada[campo] = "";
            continue;
        }
        compatibles = compatibles.filter((fila) => fila[campo] === valor);
    }

    if (ajustada.especie && !ajustada.variedad) {
        const variedades = opciones(compatibles.map((fila) => fila.variedad));
        if (variedades.length === 1 && variedades[0] === "-") ajustada.variedad = "-";
    }

    return ajustada;
}

function leerPrecio(valor: string): number | null {
    if (valor === "") return null;
    const precio = Number(valor.replace(",", "."));
    return Number.isFinite(precio) ? precio : null;
}

export default function PreciosReferencia({ fechaRelevamiento, filas }: Props) {
    const [busqueda, setBusqueda] = useState("");
    const [seleccion, setSeleccion] = useState<SeleccionFiltros>(FILTROS_VACIOS);
    const { especie, variedad, pais, unidad, categoria, calibre } = seleccion;
    const [precioPor, setPrecioPor] = useState<"unidad" | "kg">("unidad");
    const [precioMinimo, setPrecioMinimo] = useState("");
    const [precioMaximo, setPrecioMaximo] = useState("");
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [soloReferencias, setSoloReferencias] = useState(false);
    const [pagina, setPagina] = useState(1);
    const panelFiltrosRef = useRef<HTMLDivElement>(null);
    const contenidoFiltrosRef = useRef<HTMLDivElement>(null);

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

    const disponibles = useMemo(() => ({
        especies: opciones(filas.map((fila) => fila.especie)),
        variedades: especie ? opciones(filasCompatibles(filas, seleccion, ["variedad", "unidad"]).map((fila) => fila.variedad)) : [],
        unidades: variedad ? opciones(filasCompatibles(filas, seleccion, ["unidad"]).map((fila) => fila.unidad)) : [],
        paises: opciones(filasCompatibles(filas, seleccion, ["pais"]).map((fila) => fila.pais)),
        categorias: opciones(filasCompatibles(filas, seleccion, ["categoria"]).map((fila) => fila.categoria)),
        calibres: opciones(filasCompatibles(filas, seleccion, ["calibre"]).map((fila) => fila.calibre)),
    }), [filas, seleccion, especie, variedad]);
    const cantidadReferencias = useMemo(() => filas.filter((fila) => fila.esReferencia).length, [filas]);
    const minimo = leerPrecio(precioMinimo);
    const maximo = leerPrecio(precioMaximo);
    const rangoPrecioInvalido = minimo !== null && maximo !== null && maximo < minimo;

    const filtradas = useMemo(() => {
        const palabras = normalizar(busqueda.trim()).split(/\s+/).filter(Boolean);
        if (rangoPrecioInvalido) return [];
        return filas
            .filter((fila) => {
                if (especie && fila.especie !== especie) return false;
                if (variedad && fila.variedad !== variedad) return false;
                if (pais && fila.pais !== pais) return false;
                if (unidad && fila.unidad !== unidad) return false;
                if (categoria && fila.categoria !== categoria) return false;
                if (calibre && fila.calibre !== calibre) return false;
                if (soloReferencias && !fila.esReferencia) return false;
                const precioFilaMinimo = precioPor === "unidad" ? fila.precioMinimoUnidad : fila.precioMinimoKg;
                const precioFilaMaximo = precioPor === "unidad" ? fila.precioMaximoUnidad : fila.precioMaximoKg;
                if (minimo !== null && precioFilaMinimo < minimo) return false;
                if (maximo !== null && precioFilaMaximo > maximo) return false;
                const texto = normalizar(`${fila.especie} ${fila.variedad} ${fila.pais}`);
                return palabras.every((palabra) => texto.includes(palabra));
            })
            .sort(
                (a, b) =>
                    comparar(a.especie, b.especie) ||
                    comparar(a.variedad, b.variedad) ||
                    comparar(a.pais, b.pais) ||
                    comparar(a.calibre, b.calibre) ||
                    comparar(a.categoria, b.categoria),
            );
    }, [filas, busqueda, especie, variedad, pais, unidad, categoria, calibre, soloReferencias, precioPor, minimo, maximo, rangoPrecioInvalido]);

    const totalPaginas = Math.max(1, Math.ceil(filtradas.length / LIMITE));
    const paginaActual = Math.min(pagina, totalPaginas);
    const desde = (paginaActual - 1) * LIMITE;
    const visibles = filtradas.slice(desde, desde + LIMITE);
    const [anio, mes, dia] = fechaRelevamiento.split("-");

    function cambiar(accion: () => void) {
        accion();
        setPagina(1);
    }

    function cambiarFiltro(campo: CampoFiltro, valor: string) {
        cambiar(() => setSeleccion((actual) => {
            const siguiente = { ...actual, [campo]: valor };
            if (campo === "especie") {
                siguiente.variedad = "";
                siguiente.unidad = "";
            }
            if (campo === "variedad") siguiente.unidad = "";
            return ajustarSeleccion(filas, siguiente, campo);
        }));
    }

    function cambiarPrecio(valor: string, actualizar: (valor: string) => void) {
        if (valor === "" || /^\d+(?:[.,]\d*)?$/.test(valor)) cambiar(() => actualizar(valor));
    }

    function limpiar() {
        setBusqueda("");
        setSeleccion(FILTROS_VACIOS);
        setPrecioPor("unidad");
        setPrecioMinimo("");
        setPrecioMaximo("");
        setSoloReferencias(false);
        setPagina(1);
    }

    return (
        <div className={styles.pagina}>
            <EncabezadoPagina titulo="Precios de referencia" cantidad={filas.length} subtitulo="registros del relevamiento" />

            <div className={styles.contexto}>
                <p>Relevamiento del <strong>{dia}/{mes}/{anio}</strong></p>
                <span className={styles.punto} aria-hidden="true">·</span>
                <p><strong>{cantidadReferencias}</strong> registros marcados como referencia</p>
            </div>

            <section className={styles.filtrosPanel} aria-label="Filtros de precios de referencia">
                <div className={styles.filtros}>
                    <TextField
                        className={`${styles.campo} ${styles.busqueda}`}
                        label="Buscar especie o variedad"
                        type="search"
                        size="small"
                        value={busqueda}
                        onChange={(e) => cambiar(() => setBusqueda(e.target.value))}
                        slotProps={{ input: { startAdornment: <SearchIcon aria-hidden="true" sx={{ color: "var(--color-muted)" }} /> } }}
                    />
                    <TextField
                        className={`${styles.campo} ${styles.filtroEspecie}`}
                        select
                        label="Especie"
                        size="small"
                        value={especie}
                        onChange={(e) => cambiarFiltro("especie", e.target.value)}
                        slotProps={menu}
                    >
                        <MenuItem value="" className={styles.opcionSelect}>Todas las especies</MenuItem>
                        {disponibles.especies.map((v) => (
                            <MenuItem key={v} value={v} className={styles.opcionSelect}>{v}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        className={`${styles.campo} ${styles.filtroVariedad}`}
                        select
                        label="Variedad"
                        size="small"
                        value={variedad}
                        disabled={!especie || (disponibles.variedades.length === 1 && disponibles.variedades[0] === "-")}
                        onChange={(e) => cambiarFiltro("variedad", e.target.value)}
                        slotProps={menu}
                    >
                        <MenuItem value="" className={styles.opcionSelect}>Todas las variedades</MenuItem>
                        {disponibles.variedades.map((v) => (
                            <MenuItem key={v} value={v} className={styles.opcionSelect}>{v}</MenuItem>
                        ))}
                    </TextField>
                    <button
                        type="button"
                        className={styles.botonMasFiltros}
                        aria-expanded={mostrarFiltros}
                        aria-controls="filtros-adicionales-precios"
                        onClick={() => setMostrarFiltros((abiertos) => !abiertos)}
                    >
                        Más filtros
                        {mostrarFiltros ? <KeyboardArrowUpIcon className={styles.iconoExpandir} /> : <KeyboardArrowDownIcon className={styles.iconoExpandir} />}
                    </button>
                    <div ref={panelFiltrosRef} id="filtros-adicionales-precios" className={`${styles.filtrosAdicionales} ${mostrarFiltros ? styles.filtrosAbiertos : ""}`}>
                        <div ref={contenidoFiltrosRef} className={styles.contenidoAdicional}>
                            <TextField
                                className={`${styles.campo} ${styles.filtroPais}`}
                                select
                                label="País"
                                size="small"
                                value={pais}
                                onChange={(e) => cambiarFiltro("pais", e.target.value)}
                                slotProps={menu}
                            >
                                <MenuItem value="" className={styles.opcionSelect}>Todos los países</MenuItem>
                                {disponibles.paises.map((v) => (
                                    <MenuItem key={v} value={v} className={styles.opcionSelect}>{v}</MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                className={`${styles.campo} ${styles.filtroUnidad}`}
                                select
                                label="Presentación"
                                size="small"
                                value={unidad}
                                disabled={!variedad}
                                onChange={(e) => cambiarFiltro("unidad", e.target.value)}
                                slotProps={menu}
                            >
                                <MenuItem value="" className={styles.opcionSelect}>Todas las presentaciones</MenuItem>
                                {disponibles.unidades.map((v) => (
                                    <MenuItem key={v} value={v} className={styles.opcionSelect}>{v}</MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                className={`${styles.campo} ${styles.filtroCategoria}`}
                                select
                                label="Categoría"
                                size="small"
                                value={categoria}
                                onChange={(e) => cambiarFiltro("categoria", e.target.value)}
                                slotProps={menu}
                            >
                                <MenuItem value="" className={styles.opcionSelect}>Todas las categorías</MenuItem>
                                {disponibles.categorias.map((v) => (
                                    <MenuItem key={v} value={v} className={styles.opcionSelect}>{v}</MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                className={`${styles.campo} ${styles.filtroCalibre}`}
                                select
                                label="Calibre"
                                size="small"
                                value={calibre}
                                onChange={(e) => cambiarFiltro("calibre", e.target.value)}
                                slotProps={menu}
                            >
                                <MenuItem value="" className={styles.opcionSelect}>Todos los calibres</MenuItem>
                                {disponibles.calibres.map((v) => (
                                    <MenuItem key={v} value={v} className={styles.opcionSelect}>{v}</MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                className={`${styles.campo} ${styles.filtroPrecioPor}`}
                                select
                                label="Precio por"
                                size="small"
                                value={precioPor}
                                onChange={(e) => {
                                    const valor = e.target.value;
                                    if (valor === "unidad" || valor === "kg") cambiar(() => setPrecioPor(valor));
                                }}
                                slotProps={menu}
                            >
                                <MenuItem value="unidad" className={styles.opcionSelect}>Unidad</MenuItem>
                                <MenuItem value="kg" className={styles.opcionSelect}>Kg</MenuItem>
                            </TextField>
                            <TextField
                                className={`${styles.campo} ${styles.filtroPrecioMinimo}`}
                                label="Precio mínimo"
                                type="text"
                                size="small"
                                value={precioMinimo}
                                placeholder="$ 0"
                                onChange={(e) => cambiarPrecio(e.target.value, setPrecioMinimo)}
                                slotProps={{ htmlInput: { inputMode: "decimal", pattern: "[0-9]+([.,][0-9]*)?" } }}
                            />
                            <TextField
                                className={`${styles.campo} ${styles.filtroPrecioMaximo}`}
                                label="Precio máximo"
                                type="text"
                                size="small"
                                value={precioMaximo}
                                placeholder="Sin límite"
                                error={rangoPrecioInvalido}
                                onChange={(e) => cambiarPrecio(e.target.value, setPrecioMaximo)}
                                slotProps={{ htmlInput: { inputMode: "decimal", pattern: "[0-9]+([.,][0-9]*)?" } }}
                            />
                            {rangoPrecioInvalido && <p className={styles.errorPrecio} role="alert">El precio máximo no puede ser menor al mínimo.</p>}
                        </div>
                    </div>
                </div>
                <div className={styles.barraOpciones}>
                    <label className={styles.soloReferencias}>
                        <input type="checkbox" checked={soloReferencias} onChange={(e) => cambiar(() => setSoloReferencias(e.target.checked))} />
                        Solo registros de referencia
                    </label>
                </div>
                <div className={styles.pieFiltros}>
                    <span className={styles.resultadosFiltros}>{filtradas.length} resultados</span>
                    <button type="button" className={styles.limpiarFiltros} onClick={limpiar}>Limpiar filtros</button>
                </div>
            </section>

            <section className={styles.tablaPanel} aria-label="Precios relevados">
                <div className={styles.tablaCabecera}>
                    <div><h2>Listado de Precios de referencia</h2></div>
                </div>
                {visibles.length === 0 ? (
                    <p className={styles.vacio}>No hay registros que coincidan con los filtros.</p>
                ) : (
                    <>
                        <div className={styles.tablaContenedor}>
                            <table className={styles.tabla}>
                                <thead>
                                    <tr>
                                        <th scope="col">Especie</th>
                                        <th scope="col">Variedad</th>
                                        <th scope="col">Referencia</th>
                                        <th scope="col">Precio por unidad</th>
                                        <th scope="col">Precio por kg</th>
                                        <th scope="col">País</th>
                                        <th scope="col">Calibre</th>
                                        <th scope="col">Categoría</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibles.map((fila) => (
                                        <tr key={fila.id} className={fila.esReferencia ? styles.filaReferencia : undefined}>
                                            <td className={styles.producto}><strong>{fila.especie}</strong></td>
                                            <td className={styles.variedad}>{fila.variedad}</td>
                                            <td className={styles.referencia}>
                                                {fila.esReferencia ? (
                                                    <span className={styles.insignia}>Referencia</span>
                                                ) : (
                                                    <span className={styles.sinReferencia}>-</span>
                                                )}
                                            </td>
                                            <td className={styles.precio}>
                                                <span className={styles.etiquetaMobile}>Por {fila.unidad}</span>
                                                <strong>{rango(fila.precioMinimoUnidad, fila.precioMaximoUnidad)}</strong>
                                                <small>/{fila.unidad}</small>
                                            </td>
                                            <td className={styles.precio}>
                                                <span className={styles.etiquetaMobile}>Por kg</span>
                                                <strong>{rango(fila.precioMinimoKg, fila.precioMaximoKg)}</strong>
                                                <small>/kg</small>
                                            </td>
                                            <td className={styles.pais}>{fila.pais}</td>
                                            <td className={styles.detalle}>{fila.calibre}</td>
                                            <td className={styles.detalle}>{fila.categoria}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className={styles.listaMobile} role="list" aria-label="Precios relevados">
                            {visibles.map((fila) => (
                                <article
                                    key={fila.id}
                                    className={`${styles.filaMobile} ${fila.esReferencia ? styles.filaMobileReferencia : ""}`}
                                    role="listitem"
                                >
                                    <div className={styles.filaMobileCabecera}>
                                        <div className={styles.filaMobileProducto}>
                                            <strong>{fila.especie}</strong>
                                            {fila.variedad !== "-" && <span>{fila.variedad}</span>}
                                        </div>
                                        {fila.esReferencia && <span className={styles.insignia}>Referencia</span>}
                                    </div>
                                    <div className={styles.filaMobilePrecios}>
                                        <div>
                                            <span>{fila.unidad}</span>
                                            <strong>{rango(fila.precioMinimoUnidad, fila.precioMaximoUnidad)}</strong>
                                        </div>
                                        <div>
                                            <span>kg</span>
                                            <strong>{rango(fila.precioMinimoKg, fila.precioMaximoKg)}</strong>
                                        </div>
                                    </div>
                                    <p className={styles.filaMobileDetalles}>
                                        <span>{fila.pais}</span>
                                        <span aria-hidden="true">·</span>
                                        <span>Cal. {fila.calibre}</span>
                                        <span aria-hidden="true">·</span>
                                        <span>Cat. {fila.categoria}</span>
                                    </p>
                                </article>
                            ))}
                        </div>
                    </>
                )}
                {filtradas.length > LIMITE && (
                    <nav className={styles.paginacion} aria-label="Páginas de precios de referencia">
                        <span>{desde + 1}-{Math.min(desde + LIMITE, filtradas.length)} de {filtradas.length}</span>
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
