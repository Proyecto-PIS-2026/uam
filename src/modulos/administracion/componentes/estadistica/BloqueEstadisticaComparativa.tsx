"use client";

import { useState, useMemo } from "react";
import { TextField, MenuItem, Autocomplete } from "@mui/material";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";
import type { RangoTiempo } from "./Tipos";
import styles from "./BloqueEstadisticaComparativa.module.css";

interface DatoEstadistica {
    fecha: Date | string;
    cantidad: number;
    username?: string;
}

interface BloqueEstadisticaComparativaProps {
    contactos: DatoEstadistica[];
    publicaciones: DatoEstadistica[];
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
    if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return fecha;
    }

    const fechaDate = new Date(fecha);

    if (Number.isNaN(fechaDate.getTime())) return null;

    return obtenerFechaLocalStr(fechaDate);
};

export default function BloqueEstadisticaComparativa({ contactos, publicaciones, opcionesFiltroEspecifico = [] }: BloqueEstadisticaComparativaProps) {
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
            const fechaMasAntigua = [...contactos, ...publicaciones].reduce<string | null>((masAntigua, item) => {
                if (filtroEspecifico !== "todos" && item.username !== filtroEspecifico) return masAntigua;

                const fechaStr = obtenerFechaRegistroStr(item.fecha);
                if (fechaStr === null) return masAntigua;

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
    }, [rango, fechaDesde, fechaHasta, contactos, publicaciones, filtroEspecifico, hoyStr]);

    const datosFiltrados = useMemo(() => {
        const mapaCantidades = new Map<string, { contactos: number; publicaciones: number }>();

        const acumularDatos = (items: DatoEstadistica[], tipo: "contactos" | "publicaciones") => {
            items.forEach((item) => {
                if (filtroEspecifico !== "todos" && item.username !== filtroEspecifico) return;

                const fechaItem = obtenerFechaRegistroStr(item.fecha);
                if (fechaItem === null) return;

                if (fechaItem < desdeCalculado || fechaItem > hastaCalculado) return;

                const cantidades = mapaCantidades.get(fechaItem) || { contactos: 0, publicaciones: 0 };
                cantidades[tipo] += item.cantidad;
                mapaCantidades.set(fechaItem, cantidades);
            });
        };

        acumularDatos(contactos, "contactos");
        acumularDatos(publicaciones, "publicaciones");

        const resultado: Array<{ fecha: number; contactos: number; publicaciones: number }> = [];
        const [anioIni, mesIni, diaIni] = desdeCalculado.split("-").map(Number);
        const [anioFin, mesFin, diaFin] = hastaCalculado.split("-").map(Number);

        const current = new Date(anioIni, mesIni - 1, diaIni);
        const end = new Date(anioFin, mesFin - 1, diaFin);

        while (current <= end) {
            const anio = current.getFullYear();
            const mes = String(current.getMonth() + 1).padStart(2, "0");
            const dia = String(current.getDate()).padStart(2, "0");
            const fechaStr = `${anio}-${mes}-${dia}`;
            const cantidades = mapaCantidades.get(fechaStr) || { contactos: 0, publicaciones: 0 };

            resultado.push({
                fecha: new Date(fechaStr + "T00:00:00").getTime(),
                contactos: cantidades.contactos,
                publicaciones: cantidades.publicaciones,
            });

            current.setDate(current.getDate() + 1);
        }

        return resultado;
    }, [contactos, publicaciones, desdeCalculado, hastaCalculado, filtroEspecifico]);

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

    const totalesHoy = useMemo(() => {
        const calcularTotal = (items: DatoEstadistica[]) => {
            return items.filter((item) => {
                const fechaItem = obtenerFechaRegistroStr(item.fecha);
                if (fechaItem === null) return false;

                if (fechaItem !== hoyStr) return false;
                if (filtroEspecifico !== "todos" && item.username !== filtroEspecifico) return false;
                return true;
            }).reduce((acc, curr) => acc + curr.cantidad, 0);
        };

        return {
            contactos: calcularTotal(contactos),
            publicaciones: calcularTotal(publicaciones),
        };
    }, [contactos, publicaciones, hoyStr, filtroEspecifico]);

    const totalesRango = useMemo(() => {
        return datosFiltrados.reduce((acc, curr) => ({
            contactos: acc.contactos + curr.contactos,
            publicaciones: acc.publicaciones + curr.publicaciones,
        }), { contactos: 0, publicaciones: 0 });
    }, [datosFiltrados]);

    return (
        <div className={styles.bloqueSeccion}>
            <div className={styles.encabezadoBloque}>
                <h3>Publicaciones y Contactos</h3>
                <p>Visualización estadística de la cantidad de Publicaciones y Contactos de WhatsApp</p>
            </div>
            <div className={styles.contenedorFiltros}>
                <Autocomplete className={styles.filtroUsuario} options={opcionesFiltroEspecifico} getOptionLabel={(op) => op.etiqueta} value={opcionesFiltroEspecifico.find((op) => op.valor === filtroEspecifico) || null}
                    onChange={(_, newValue) => setFiltroEspecifico(newValue ? newValue.valor : "todos")} renderInput={(params) => <TextField {...params} fullWidth label="Usuario" size="small" placeholder="Escribí para buscar..." />} noOptionsText="No se encontraron usuarios"
                />

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
                    <div className={styles.detallesMetricas}>
                        <div className={styles.detalleMetrica}>
                            <span>Publicaciones</span>
                            <strong className={styles.valorPublicaciones}>{formateadorNumero.format(totalesHoy.publicaciones)}</strong>
                        </div>
                        <div className={styles.detalleMetrica}>
                            <span>Contactos de WhatsApp</span>
                            <strong className={styles.valorContactos}>{formateadorNumero.format(totalesHoy.contactos)}</strong>
                        </div>
                    </div>
                </div>

                <div className={styles.tarjetaMetrica}>
                    <span className={styles.tituloTarjeta}>Total del Rango Seleccionado</span>
                    <div className={styles.detallesMetricas}>
                        <div className={styles.detalleMetrica}>
                            <span>Publicaciones</span>
                            <strong className={styles.valorPublicaciones}>{formateadorNumero.format(totalesRango.publicaciones)}</strong>
                        </div>
                        <div className={styles.detalleMetrica}>
                            <span>Contactos de WhatsApp</span>
                            <strong className={styles.valorContactos}>{formateadorNumero.format(totalesRango.contactos)}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.contenedorGrafica}>
                <div className={styles.leyendaGrafica}>
                    <div className={styles.itemLeyenda}>
                        <span className={styles.lineaLeyendaPublicaciones}></span>
                        <span>Publicaciones</span>
                    </div>
                    <div className={styles.itemLeyenda}>
                        <span className={styles.lineaLeyendaWhatsApp}></span>
                        <span>WhatsApp</span>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={270}>
                    <LineChart data={datosFiltrados} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis type="number" dataKey="fecha" domain={['dataMin', 'dataMax']} ticks={ticksEjeX} interval={0} minTickGap={0} tick={{ className: styles.etiquetaEje }} padding={{ left: 0, right: 0 }}
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
                        <YAxis allowDecimals={false} domain={[0, "auto"]} tick={{ fontSize: 11 }} />
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
                            formatter={(value, name) => [
                                formateadorNumero.format(Number(value ?? 0)),
                                name
                            ]}
                        />
                        <Line name="Publicaciones" type="linear" dataKey="publicaciones" stroke="var(--color-secondary, #005d29)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                        <Line name="WhatsApp" type="linear" dataKey="contactos" stroke="var(--color-primary, #16a34a)" strokeWidth={2} strokeDasharray="3 3" dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}