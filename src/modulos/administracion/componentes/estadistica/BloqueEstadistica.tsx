
"use client";

import { useState, useMemo } from "react";
import { TextField, MenuItem, Autocomplete } from "@mui/material";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";
import type { RangoTiempo, TipoSeccionEstadistica } from "./Tipos";
import styles from "./BloqueEstadistica.module.css";

interface BloqueEstadisticaProps {
    titulo: string;
    tipo: TipoSeccionEstadistica;
    datos: Array<{ fecha: Date | string; cantidad: number; tipoVisitante?: string; username?: string }>;
    opcionesFiltroEspecifico?: Array<{ valor: string; etiqueta: string }>;
}

const formateadorNumero = new Intl.NumberFormat("es-UY");

const obtenerFechaLocalStr = (date: Date) => {
    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const dia = String(date.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
};

const obtenerFechaRegistroStr = (fecha: Date | string): string | null => {
    if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;

    const fechaDate = new Date(fecha);
    if (Number.isNaN(fechaDate.getTime())) return null;

    return obtenerFechaLocalStr(fechaDate);
};

export default function BloqueEstadistica({ titulo, tipo, datos, opcionesFiltroEspecifico = [] }: BloqueEstadisticaProps) {
    const hoyStr = obtenerFechaLocalStr(new Date());

    const [rango, setRango] = useState<RangoTiempo>("1m");
    const [fechaDesde, setFechaDesde] = useState(() => {
        const desde = new Date();
        const dia = desde.getDate();
        desde.setDate(1);
        desde.setMonth(desde.getMonth() - 1);
        const ultimoDiaMesAnterior = new Date(desde.getFullYear(), desde.getMonth() + 1, 0).getDate();
        desde.setDate(Math.min(dia, ultimoDiaMesAnterior));
        return obtenerFechaLocalStr(desde);
    });
    const [fechaHasta, setFechaHasta] = useState(hoyStr);
    const [filtroEspecifico, setFiltroEspecifico] = useState("todos");

    const { desdeCalculado, hastaCalculado } = useMemo(() => {
        const hasta = new Date();
        const desde = new Date();

        if (rango === "todo") {
            const fechaMasAntigua = datos.reduce<string | null>((masAntigua, item) => {
                if (tipo === "visitas" && filtroEspecifico !== "todos" && item.tipoVisitante?.toLowerCase() !== filtroEspecifico.toLowerCase()) return masAntigua;
                if ((tipo === "contactos" || tipo === "publicaciones") && filtroEspecifico !== "todos" && item.username !== filtroEspecifico) return masAntigua;

                const fechaStr = obtenerFechaRegistroStr(item.fecha);
                if (!fechaStr) return masAntigua;

                return masAntigua === null || fechaStr < masAntigua ? fechaStr : masAntigua;
            }, null);

            return {
                desdeCalculado: fechaMasAntigua ?? hoyStr,
                hastaCalculado: hoyStr,
            };
        }

        if (rango === "1s") desde.setDate(hasta.getDate() - 7);
        else if (rango === "1m") desde.setMonth(hasta.getMonth() - 1);
        else if (rango === "3m") desde.setMonth(hasta.getMonth() - 3);
        else if (rango === "6m") desde.setMonth(hasta.getMonth() - 6);
        else if (rango === "1y") desde.setFullYear(hasta.getFullYear() - 1);
        else return { desdeCalculado: fechaDesde, hastaCalculado: fechaHasta };

        return {
            desdeCalculado: obtenerFechaLocalStr(desde),
            hastaCalculado: obtenerFechaLocalStr(hasta),
        };
    }, [rango, fechaDesde, fechaHasta, datos, filtroEspecifico, tipo, hoyStr]);

    const datosFiltrados = useMemo(() => {
        const mapaCantidades = new Map<string, number>();

        datos.forEach((item) => {
            const fechaItem = obtenerFechaRegistroStr(item.fecha);
            if (!fechaItem || fechaItem < desdeCalculado || fechaItem > hastaCalculado) return;

            if (tipo === "visitas" && filtroEspecifico !== "todos" && item.tipoVisitante?.toLowerCase() !== filtroEspecifico.toLowerCase()) return;
            if ((tipo === "contactos" || tipo === "publicaciones") && filtroEspecifico !== "todos" && item.username !== filtroEspecifico) return;

            mapaCantidades.set(fechaItem, (mapaCantidades.get(fechaItem) || 0) + item.cantidad);
        });

        const resultado: Array<{ fecha: number; cantidad: number }> = [];
        const [anioIni, mesIni, diaIni] = desdeCalculado.split("-").map(Number);
        const [anioFin, mesFin, diaFin] = hastaCalculado.split("-").map(Number);

        const current = new Date(anioIni, mesIni - 1, diaIni);
        const end = new Date(anioFin, mesFin - 1, diaFin);

        while (current <= end) {
            const anio = current.getFullYear();
            const mes = String(current.getMonth() + 1).padStart(2, "0");
            const dia = String(current.getDate()).padStart(2, "0");
            const fechaStr = `${anio}-${mes}-${dia}`;

            resultado.push({
                fecha: new Date(fechaStr + "T00:00:00").getTime(),
                cantidad: mapaCantidades.get(fechaStr) || 0,
            });
            current.setDate(current.getDate() + 1);
        }

        return resultado;
    }, [datos, desdeCalculado, hastaCalculado, filtroEspecifico, tipo]);

    const ticksEjeX = useMemo(() => {
        const cantidadTicks = Math.min(5, datosFiltrados.length);
        if (cantidadTicks === 0) return [];

        const fechaInicial = datosFiltrados[0].fecha;
        const fechaFinal = datosFiltrados[datosFiltrados.length - 1].fecha;

        if (cantidadTicks === 1) return [fechaInicial];

        return Array.from({ length: cantidadTicks }, (_, i) => {
            return fechaInicial + (fechaFinal - fechaInicial) * i / (cantidadTicks - 1);
        });
    }, [datosFiltrados]);

    const totalHoy = useMemo(() => {
        return datos.filter((item) => {
            const fechaItem = obtenerFechaRegistroStr(item.fecha);
            if (fechaItem !== hoyStr) return false;
            if (tipo === "visitas" && filtroEspecifico !== "todos" && item.tipoVisitante?.toLowerCase() !== filtroEspecifico.toLowerCase()) return false;
            if ((tipo === "contactos" || tipo === "publicaciones") && filtroEspecifico !== "todos" && item.username !== filtroEspecifico) return false;
            return true;
        }).reduce((acc, curr) => acc + curr.cantidad, 0);
    }, [datos, hoyStr, filtroEspecifico, tipo]);

    const totalRango = useMemo(() => {
        return datosFiltrados.reduce((acc, curr) => acc + curr.cantidad, 0);
    }, [datosFiltrados]);

    return (
        <div className={styles.bloqueSeccion}>
            <div className={styles.encabezadoBloque}>
                <h3>{titulo}</h3>
                <p>Visualización estadística de la cantidad de {titulo}</p>
            </div>
            <div className={styles.contenedorFiltros}>
                {tipo === "visitas" ? (
                    <TextField className={styles.filtroVisitante} select label="Tipo de Visitante" size="small" value={filtroEspecifico} onChange={(e) => setFiltroEspecifico(e.target.value)}>
                        <MenuItem value="todos">Todos</MenuItem>
                        <MenuItem value="comprador">Compradores</MenuItem>
                        <MenuItem value="operador">Operadores</MenuItem>
                        <MenuItem value="productor">Productores</MenuItem>
                    </TextField>
                ) : (
                    <Autocomplete className={styles.filtroUsuario} options={opcionesFiltroEspecifico} getOptionLabel={(op) => op.etiqueta} value={opcionesFiltroEspecifico.find((op) => op.valor === filtroEspecifico) || null}
                        onChange={(_, newValue) => setFiltroEspecifico(newValue ? newValue.valor : "todos")} renderInput={(params) => <TextField {...params} fullWidth label="Usuario" size="small" placeholder="Escribí para buscar..." />} noOptionsText="No se encontraron usuarios"
                    />
                )}

                <TextField className={styles.filtroPeriodo} select label="Período" size="small" value={rango} onChange={(e) => setRango(e.target.value as RangoTiempo)}>
                    <MenuItem value="1s">1 semana</MenuItem>
                    <MenuItem value="1m">1 mes</MenuItem>
                    <MenuItem value="3m">3 meses</MenuItem>
                    <MenuItem value="6m">6 meses</MenuItem>
                    <MenuItem value="1y">1 año</MenuItem>
                    <MenuItem value="todo">Histórico total</MenuItem>
                    <MenuItem value="personalizado">Personalizado</MenuItem>
                </TextField>

                {rango === "personalizado" && (
                    <div className={styles.fechasPersonalizadas}>
                        <TextField className={styles.filtroFecha} type="date" label="Desde" size="small" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                        <TextField className={styles.filtroFecha} type="date" label="Hasta" size="small" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                    </div>
                )}
            </div>

            <div className={styles.tarjetasMetricas}>
                <div className={styles.tarjetaMetrica}>
                    <span className={styles.tituloTarjeta}>Total de Hoy</span>
                    <div className={styles.detalleMetrica}>
                        <span>{titulo}</span>
                        <strong>{formateadorNumero.format(totalHoy)}</strong>
                    </div>
                </div>
                <div className={styles.tarjetaMetrica}>
                    <span className={styles.tituloTarjeta}>Total del Rango Seleccionado</span>
                    <div className={styles.detalleMetrica}>
                        <span>{titulo}</span>
                        <strong>{formateadorNumero.format(totalRango)}</strong>
                    </div>
                </div>
            </div>

            <div className={styles.contenedorGrafica}>
                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={datosFiltrados} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis type="number" dataKey="fecha" domain={["dataMin", "dataMax"]} ticks={ticksEjeX} interval={0} minTickGap={0} tick={{ className: styles.etiquetaEje }} padding={{ left: 0, right: 0 }}
                            tickFormatter={(val: unknown) => {
                                if (typeof val === "number") {
                                    return new Date(val).toLocaleDateString("es-UY", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "2-digit",
                                    });
                                }
                                return "";
                            }}
                        />
                        <YAxis allowDecimals={false} domain={[0, "auto"]} tick={{ fontSize: 11 }}/>
                        <Tooltip trigger="hover" cursor={false} offset={10} isAnimationActive={false} separator=": "
                            labelFormatter={(label: unknown) => {
                                if (typeof label === "number") {
                                    return `Fecha: ${new Date(label).toLocaleDateString("es-UY", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                    })}`;
                                }
                                return "";
                            }}
                            formatter={(value) => [
                                formateadorNumero.format(Number(value ?? 0)),
                                "Cantidad"
                            ]}
                        />
                        <Line type="linear" dataKey="cantidad" stroke="var(--color-secondary, #005d29)" strokeWidth={2} dot={false} activeDot={{ r: 5 }}/>
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
