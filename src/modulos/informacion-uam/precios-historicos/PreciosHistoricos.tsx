"use client";

import { useMemo, useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Link from "next/link";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import type { ProductoSeleccionado, HistoricoProducto } from "./tipos";
import styles from "./PreciosHistoricos.module.css";

type Props = { producto: ProductoSeleccionado; historico: HistoricoProducto | null };
const formatoNumero = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 2 });
const formatoFecha = new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

function fechaActualISO() {
    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const obtener = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? "";
    return `${obtener("year")}-${obtener("month")}-${obtener("day")}`;
}

function fechaHaceUnAnio(fecha: string) {
    const [anio, mes, dia] = fecha.split("-").map(Number);
    return new Date(Date.UTC(anio - 1, mes - 1, dia)).toISOString().slice(0, 10);
}

function coincideSiEstaDefinido(seleccionado: string, historico: string) {
    return seleccionado === "" || seleccionado === "-" || seleccionado === historico;
}

function coincideProducto(producto: ProductoSeleccionado, historico: HistoricoProducto) {
    try {
        const ids = JSON.parse(producto.id) as unknown[];
        return Number(ids[0]) === historico.classification_id
            && Number(ids[1]) === historico.species_id
            && producto.especie === historico.species;
    } catch {
        return producto.especie === historico.species;
    }
}

export default function PreciosHistoricos({ producto, historico }: Props) {
    const hoy = fechaActualISO();
    const [desde, setDesde] = useState(() => fechaHaceUnAnio(hoy));
    const [hasta, setHasta] = useState(hoy);
    const rangoInvalido = desde > hasta;
    const filas = useMemo(() => {
        if (!historico || !coincideProducto(producto, historico) || desde > hasta) return [];
        return historico.series
            .filter((dia) => dia.date >= desde && dia.date <= hasta)
            .flatMap((dia) => dia.presentations.flatMap((presentacion) => {
                if (!coincideSiEstaDefinido(producto.variedad, presentacion.variety)
                    || !coincideSiEstaDefinido(producto.pais, presentacion.country)
                    || !coincideSiEstaDefinido(producto.calibre, presentacion.caliber)) return [];
                return presentacion.prices
                    .filter((precio) => coincideSiEstaDefinido(producto.categoria, precio.category))
                    .map((precio) => ({ dia, presentacion, precio }));
            }));
    }, [historico, producto, desde, hasta]);

    return (
        <div className={styles.pagina}>
            <Link className={styles.volver} href="/precios-referencia">
                <ArrowBackIcon fontSize="small" /> Volver a precios de referencia
            </Link>
            <EncabezadoPagina titulo={`Histórico de ${producto.especie}`} cantidad={filas.length} subtitulo="registros históricos" />

            <section className={styles.filtrosPanel} aria-label="Intervalo del histórico">
                <div className={styles.filtrosCabecera}>
                    <h2>Período</h2>
                </div>
                <div className={styles.camposFecha}>
                    <label>Desde<input aria-label="Desde" type="date" value={desde} max={hasta || undefined} onChange={(evento) => setDesde(evento.target.value)} /></label>
                    <span className={styles.separador}>—</span>
                    <label>Hasta<input aria-label="Hasta" type="date" value={hasta} min={desde || undefined} max={hoy} onChange={(evento) => setHasta(evento.target.value)} /></label>
                </div>
                {rangoInvalido && <p className={styles.vacio}>La fecha de inicio debe ser anterior a la fecha de fin.</p>}
                {!rangoInvalido && filas.length === 0 && <p className={styles.vacio}>No hay registros históricos para la selección y el período indicados.</p>}
            </section>

            <section className={styles.tablaPanel} aria-label={`Histórico de ${producto.especie}`}>
                <div className={styles.tablaCabecera}><h2>Histórico de precios</h2></div>
                <div className={styles.tablaContenedor}>
                    <table className={styles.tabla}>
                        <thead><tr>
                            <th scope="col">Fecha</th><th scope="col">Variedad</th><th scope="col">País</th>
                            <th scope="col">Calibre</th><th scope="col">Categoría</th><th scope="col">Precio por kg</th><th scope="col">Volumen</th>
                        </tr></thead>
                        <tbody>
                            {filas.map(({ dia, presentacion, precio }, indice) => (
                                <tr key={`${dia.date}-${presentacion.country}-${presentacion.caliber}-${precio.category}-${indice}`}>
                                    <td>{formatoFecha.format(new Date(`${dia.date}T00:00:00Z`))}</td>
                                    <td>{presentacion.variety}</td><td>{presentacion.country}</td><td>{presentacion.caliber}</td><td>{precio.category}</td>
                                    <td className={styles.precio}>${formatoNumero.format(precio.min_kg)} – ${formatoNumero.format(precio.max_kg)}{precio.is_reference && <small>Referencia</small>}</td>
                                    <td>{formatoNumero.format(dia.volume_kg)} kg</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.listaMobile}>
                    {filas.map(({ dia, presentacion, precio }, indice) => (
                        <article className={styles.filaMobile} key={`${dia.date}-${presentacion.country}-${presentacion.caliber}-${precio.category}-${indice}`}>
                            <header><strong>{formatoFecha.format(new Date(`${dia.date}T00:00:00Z`))}</strong><span>{presentacion.variety}</span></header>
                            <p>{presentacion.country} · Cal. {presentacion.caliber} · Cat. {precio.category}</p>
                            <div><strong>${formatoNumero.format(precio.min_kg)} – ${formatoNumero.format(precio.max_kg)} / kg</strong>{precio.is_reference && <small>Referencia</small>}</div>
                            <span className={styles.volumen}>Volumen: {formatoNumero.format(dia.volume_kg)} kg</span>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}
