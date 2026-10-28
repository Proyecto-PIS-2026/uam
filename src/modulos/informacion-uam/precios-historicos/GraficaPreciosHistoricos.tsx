"use client";

import { useId, useMemo } from "react";
import PlaylistRemoveOutlinedIcon from "@mui/icons-material/PlaylistRemoveOutlined";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type LabelProps, type TooltipContentProps, type TooltipValueType } from "recharts";
import { agruparPreciosPorFecha, obtenerExtremos, obtenerFechasAnteriores, separarPuntosDistantes, type PuntoGraficaHistorica, type RegistroGrafica } from "./datos-grafica";
import { esFechaISO, fechaActualMontevideo } from "./parametros-consulta";
import styles from "./GraficaPreciosHistoricos.module.css";

type Props = {
    registros: RegistroGrafica[];
    desde: string;
    hasta: string;
    producto: string;
    cargando?: boolean;
    error?: boolean;
};

const numero = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 2 });
const fechaCompleta = new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const fechaEje = new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });

function precio(valor: number) {
    return `$${numero.format(valor)}`;
}

function fecha(valor: string) {
    if (!esFechaISO(valor)) return "—";
    return fechaCompleta.format(new Date(`${valor}T12:00:00.000Z`));
}

function EtiquetaExtremo({ viewBox, titulo, valor, dia, color, separar = false }: LabelProps & {
    titulo: string;
    valor: number;
    dia: string;
    color: string;
    separar?: boolean;
}) {
    if (!viewBox || !("x" in viewBox) || !("y" in viewBox) || !("width" in viewBox)
        || typeof viewBox.x !== "number" || typeof viewBox.y !== "number" || typeof viewBox.width !== "number") return <g />;

    const x = viewBox.x + 6;
    const compacto = viewBox.width < 420;
    const y = viewBox.y - (separar ? compacto ? 52 : 30 : compacto ? 22 : 9);
    return (
        <text x={x} y={y} fill={color} className={styles.etiquetaExtremo} textAnchor="start">
            {compacto ? (
                <>
                    <tspan x={x}>{titulo} {precio(valor)}</tspan>
                    <tspan x={x} dy={14}>{fecha(dia)}</tspan>
                </>
            ) : `${titulo} ${precio(valor)} · ${fecha(dia)}`}
        </text>
    );
}

function DetalleDia({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
    const punto = payload?.[0]?.payload as PuntoGraficaHistorica | undefined;
    if (!active || !punto || (punto.minimo === null && punto.maximo === null)) return null;
    return (
        <div className={styles.tooltip}>
            <strong>{fecha(punto.fecha)}</strong>
            <p className={styles.valorMinimo}>Mínimo: {punto.minimo === null ? "—" : `${precio(punto.minimo)}/kg`}</p>
            <p className={styles.valorMaximo}>Máximo: {punto.maximo === null ? "—" : `${precio(punto.maximo)}/kg`}</p>
            <small>{punto.cantidad} {punto.cantidad === 1 ? "registro" : "registros"}</small>
        </div>
    );
}

function EtiquetaFechaAnterior({ viewBox, dia, posicion }: LabelProps & { dia: string; posicion: number }) {
    if (!viewBox || !("x" in viewBox) || !("y" in viewBox)
        || typeof viewBox.x !== "number" || typeof viewBox.y !== "number") return <g />;

    const anclaje = posicion < .2 ? "start" : posicion > .8 ? "end" : "middle";
    const ajuste = anclaje === "start" ? 4 : anclaje === "end" ? -4 : 0;
    const x = viewBox.x + ajuste;
    const [anio, mes, diaMes] = dia.split("-");
    return (
        <text textAnchor={anclaje} className={styles.etiquetaFechaAnterior} aria-label={fecha(dia)}>
            <tspan x={x} y={viewBox.y - 10} className={styles.fechaAnteriorCompleta} aria-hidden="true">{fecha(dia)}</tspan>
            <tspan x={x} y={viewBox.y - 22} className={styles.fechaAnteriorCompacta} aria-hidden="true">{diaMes}/{mes}</tspan>
            <tspan x={x} y={viewBox.y - 10} className={styles.fechaAnteriorCompacta} aria-hidden="true">{anio}</tspan>
        </text>
    );
}

export default function GraficaPreciosHistoricos({ registros, desde, hasta, producto, cargando = false, error = false }: Props) {
    const id = useId();
    const hoy = fechaActualMontevideo();
    const fechasAnteriores = useMemo(() => obtenerFechasAnteriores(desde, hasta, hoy), [desde, hasta, hoy]);
    const puntos = useMemo(() => agruparPreciosPorFecha(registros).filter((punto) => punto.fecha >= desde && punto.fecha <= hasta), [registros, desde, hasta]);
    const puntosGrafica = useMemo(() => separarPuntosDistantes(puntos), [puntos]);
    const extremos = useMemo(() => obtenerExtremos(puntos), [puntos]);
    const inicio = Date.parse(`${desde}T00:00:00.000Z`);
    const fin = Date.parse(`${hasta}T23:59:59.999Z`);
    const dominioX: [number, number] = [inicio, fin];
    const ticks = desde === hasta
        ? [Date.parse(`${desde}T12:00:00.000Z`)]
        : [inicio, inicio + (fin - inicio) / 4, inicio + (fin - inicio) / 2, inicio + (fin - inicio) * 3 / 4, fin];
    // Ambas series pueden cruzarse: el eje abarca todos sus valores sin corregirlos.
    const dominioY = useMemo<[number, number]>(() => {
        let menor = Infinity;
        let mayor = -Infinity;
        for (const punto of puntos) {
            for (const valor of [punto.minimo, punto.maximo]) {
                if (valor === null) continue;
                menor = Math.min(menor, valor);
                mayor = Math.max(mayor, valor);
            }
        }
        if (menor === Infinity) return [0, 1];
        const margen = Math.max((mayor - menor) * .2, .5);
        return [Math.floor(menor < 0 ? menor - margen : Math.max(0, menor - margen)), Math.ceil(mayor + margen)];
    }, [puntos]);
    const minimo = extremos?.minimo;
    const maximo = extremos?.maximo;
    const extremosIguales = minimo && maximo && minimo.valor === maximo.valor && minimo.fecha === maximo.fecha;
    const extremosCercanos = minimo && maximo && Math.abs(maximo.valor - minimo.valor) / (dominioY[1] - dominioY[0]) < .2;
    const diasConDatos = puntos.filter((punto) => punto.minimo !== null || punto.maximo !== null).length;
    const totalRegistros = puntos.reduce((total, punto) => total + punto.cantidad, 0);
    const disponible = !cargando && !error && extremos !== null;

    // Sin una línea vecina, el punto sigue siendo visible aunque la otra serie no tenga dato.
    function puntoAislado(campo: "minimo" | "maximo", color: string) {
        return function PuntoAislado({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) {
            if (index === undefined || cx === undefined || cy === undefined || puntosGrafica[index]?.[campo] == null
                || puntosGrafica[index - 1]?.[campo] != null || puntosGrafica[index + 1]?.[campo] != null) return <g key={index} />;
            return <circle key={index} className="recharts-line-dot" cx={cx} cy={cy} r={4} fill={color} />;
        };
    }

    return (
        <section className={styles.panel} aria-labelledby={`${id}-titulo`} aria-busy={cargando}>
            <header className={styles.encabezado}>
                <h2 id={`${id}-titulo`}>Evolución del precio</h2>
            </header>
            {disponible && (
                <>
                    <div className={styles.leyenda}>
                        <span><i className={styles.muestraMinimo} aria-hidden="true" />Mínimo diario</span>
                        <span><i className={styles.muestraMaximo} aria-hidden="true" />Máximo diario</span>
                        <span className={styles.unidad}>Pesos por kilogramo ($/kg)</span>
                    </div>
                    <p className={styles.soloLectores}>{diasConDatos} {diasConDatos === 1 ? "día" : "días"} con datos y {totalRegistros} {totalRegistros === 1 ? "registro" : "registros"}. {minimo && <>Mínimo del período: {precio(minimo.valor)}/kg el {fecha(minimo.fecha)}. </>}{maximo && <>Máximo del período: {precio(maximo.valor)}/kg el {fecha(maximo.fecha)}. </>}El listado siguiente contiene el detalle de los registros.</p>
                    {fechasAnteriores.length > 0 && <p className={styles.soloLectores}>Líneas verticales en el mismo día y mes de hoy: {fechasAnteriores.map(fecha).join(", ")}.</p>}
                </>
            )}
            <div className={styles.grafica}>
                {cargando ? (
                    <div className={styles.estado}><span className={styles.cargando} aria-hidden="true" /><p>Cargando la evolución del precio...</p></div>
                ) : error ? (
                    <div className={styles.estado}><p>La gráfica no está disponible porque no se pudieron consultar los precios.</p></div>
                ) : !extremos ? (
                    <div className={`${styles.estado} ${styles.estadoVacio}`}>
                        <PlaylistRemoveOutlinedIcon className={styles.iconoVacio} aria-hidden="true" />
                        <p>No hay precios para graficar con los filtros y el período seleccionados.</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 350 }}>
                        <LineChart data={puntosGrafica} margin={{ top: fechasAnteriores.length ? 32 : 20, right: 16, left: 0, bottom: 8 }} accessibilityLayer aria-label={`Precios diarios de ${producto}. Mínimo y máximo en pesos por kilogramo.`}>
                            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="marcaDeTiempo" type="number" scale="time" domain={dominioX} ticks={ticks} allowDataOverflow tickFormatter={(valor: number) => fechaEje.format(new Date(valor))} interval="preserveStartEnd" minTickGap={22} tick={{ fontSize: "var(--tamano-texto-auxiliar)", fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} height={30} />
                            <YAxis type="number" domain={dominioY} width="auto" tickCount={5} allowDecimals={false} allowDataOverflow tickFormatter={(valor: number) => precio(valor)} tick={{ fontSize: "var(--tamano-texto-auxiliar)", fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                            <Tooltip content={DetalleDia} isAnimationActive={false} cursor={{ stroke: "var(--color-muted)", strokeDasharray: "3 3" }} />
                            {fechasAnteriores.map((dia) => {
                                const instante = Date.parse(`${dia}T12:00:00.000Z`);
                                return <ReferenceLine key={dia} x={instante} stroke="var(--color-muted-foreground)" strokeOpacity={.7} strokeDasharray="4 5" label={<EtiquetaFechaAnterior dia={dia} posicion={(instante - inicio) / (fin - inicio)} />} />;
                            })}
                            <Line type="linear" dataKey="minimo" name="Mínimo diario" stroke="var(--precio-minimo)" strokeWidth={2} dot={puntoAislado("minimo", "var(--precio-minimo)")} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
                            <Line type="linear" dataKey="maximo" name="Máximo diario" stroke="var(--precio-maximo)" strokeWidth={2} strokeDasharray="6 3" dot={puntoAislado("maximo", "var(--precio-maximo)")} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
                            {extremosIguales ? (
                                <ReferenceLine y={minimo.valor} stroke="var(--color-muted)" strokeDasharray="3 4" label={<EtiquetaExtremo titulo="Mínimo y máximo" valor={minimo.valor} dia={minimo.fecha} color="var(--color-secondary)" />} />
                            ) : (
                                <>
                                    {maximo && <ReferenceLine y={maximo.valor} stroke="var(--precio-maximo)" strokeDasharray="3 4" label={<EtiquetaExtremo titulo="Máximo" valor={maximo.valor} dia={maximo.fecha} color="var(--precio-maximo)" separar={Boolean(extremosCercanos && minimo && maximo.valor >= minimo.valor)} />} />}
                                    {minimo && <ReferenceLine y={minimo.valor} stroke="var(--precio-minimo)" strokeDasharray="3 4" label={<EtiquetaExtremo titulo="Mínimo" valor={minimo.valor} dia={minimo.fecha} color="var(--precio-minimo)" separar={Boolean(extremosCercanos && maximo && minimo.valor > maximo.valor)} />} />}
                                </>
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </section>
    );
}
