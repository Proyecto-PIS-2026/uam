
"use client";

import { useState, useMemo } from "react";
import { TextField, MenuItem, Autocomplete } from "@mui/material";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line} from "recharts";
import type { RangoTiempo, TipoSeccionEstadistica } from "./Tipos";
import styles from "./BloqueEstadistica.module.css";

interface DatoEstadistica {
    fecha: Date | string;
    cantidad: number;
    tipoVisitante?: string;
    username?: string;
    especie?: string;
}

interface OpcionFiltro {
    valor: string;
    etiqueta: string;
}

interface BloqueEstadisticaProps {
    titulo: string;
    tipo: TipoSeccionEstadistica;
    datos: DatoEstadistica[];
}

const formateadorNumero = new Intl.NumberFormat("es-UY");
const obtenerFechaLocalStr = (date: Date) => {
    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const dia = String(date.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
};
const modificarFecha = (fecha: string, dias: number): string => {
    const [anio, mes, dia] = fecha.split("-").map(Number);
    const resultado = new Date(anio, mes - 1, dia);
    resultado.setDate(resultado.getDate() + dias);
    return obtenerFechaLocalStr(resultado);
};
const obtenerFechaRegistroStr = (fecha: Date | string): string | null => {
    if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
    const fechaDate = new Date(fecha);
    if (Number.isNaN(fechaDate.getTime())) return null;
    return obtenerFechaLocalStr(fechaDate);
};
const obtenerOpciones = (valores: string[]): OpcionFiltro[] => {
    return Array.from(new Set(valores)).filter(Boolean).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })).map((valor) => ({ valor, etiqueta: valor }));
};
const calcularCantidadPublicacionesHasta = (datos: DatoEstadistica[], fechaLimite: string, username: string): number => {
    const ultimosRegistros = new Map<string, { fecha: string; cantidad: number }>();
    datos.forEach((item) => {
        if (!item.username) return;
        if (username !== "todos" && item.username !== username) return;
        const fecha = obtenerFechaRegistroStr(item.fecha);
        if (fecha === null || fecha > fechaLimite) return;
        const anterior = ultimosRegistros.get(item.username);
        if (!anterior || fecha > anterior.fecha) ultimosRegistros.set(item.username, {fecha, cantidad: item.cantidad});
    });
    return Array.from(ultimosRegistros.values()).reduce((total, registro) => total + registro.cantidad, 0);
};

export default function BloqueEstadistica({titulo, tipo, datos}: BloqueEstadisticaProps) {
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
    const [filtroEspecie, setFiltroEspecie] = useState("todos");
    const fechaMaximaDesde = modificarFecha(fechaHasta, -1);
    const fechaMinimaHasta = modificarFecha(fechaDesde, 1);

    const cambiarFechaDesde = (nuevaFecha: string) => {
        if (!nuevaFecha || nuevaFecha >= fechaHasta) return;
        setFechaDesde(nuevaFecha);
    };

    const cambiarFechaHasta = (nuevaFecha: string) => {
        if (!nuevaFecha || nuevaFecha <= fechaDesde) return;
        setFechaHasta(nuevaFecha);
    };

    const { desdeCalculado, hastaCalculado } = useMemo(() => {
        const hasta = new Date();
        const desde = new Date();
        if (rango === "todo") {
            const fechaMasAntigua = datos.reduce<string | null>(
                (masAntigua, item) => {
                    const fechaStr = obtenerFechaRegistroStr(item.fecha);
                    if (fechaStr === null) return masAntigua;
                    return masAntigua === null || fechaStr < masAntigua ? fechaStr : masAntigua;
                },
                null,
            );
            return {desdeCalculado: fechaMasAntigua ?? hoyStr, hastaCalculado: hoyStr};
        }

        if (rango === "1s") {
            desde.setDate(hasta.getDate() - 7);
        } else if (rango === "1m") {
            desde.setMonth(hasta.getMonth() - 1);
        } else if (rango === "3m") {
            desde.setMonth(hasta.getMonth() - 3);
        } else if (rango === "6m") {
            desde.setMonth(hasta.getMonth() - 6);
        } else if (rango === "1y") {
            desde.setFullYear(hasta.getFullYear() - 1);
        } else {
            return {desdeCalculado: fechaDesde, hastaCalculado: fechaHasta};
        }
        return {desdeCalculado: obtenerFechaLocalStr(desde), hastaCalculado: obtenerFechaLocalStr(hasta)};
    }, [rango, fechaDesde, fechaHasta, datos, hoyStr]);

    const datosDelRango = useMemo(() => {
        if (desdeCalculado > hastaCalculado) return [];
        return datos.filter((item) => {
            const fecha = obtenerFechaRegistroStr(item.fecha);
            return (fecha !== null && fecha >= desdeCalculado && fecha <= hastaCalculado);
        });
    }, [datos, desdeCalculado, hastaCalculado]);

    const filtroUsuarioActivo =
        tipo === "visitas" ||
        filtroEspecifico === "todos" ||
        datosDelRango.some((item) => item.username === filtroEspecifico)
            ? filtroEspecifico
            : "todos";

    const especieDisponible = tipo !== "contactosPorPublicacion" || filtroEspecie === "todos" || datosDelRango.some((item) => item.especie === filtroEspecie);
    const combinacionDisponible = tipo !== "contactosPorPublicacion" || filtroUsuarioActivo === "todos" || filtroEspecie === "todos" || datosDelRango.some((item) => item.username === filtroUsuarioActivo && item.especie === filtroEspecie);
    const filtroEspecieActivo = especieDisponible && combinacionDisponible ? filtroEspecie : "todos";

    const opcionesUsuarios = useMemo(() => {
        const usuarios = datosDelRango.filter((item) => {
            if (!item.username) return false;
            if (tipo === "contactosPorPublicacion" && filtroEspecieActivo !== "todos") return item.especie === filtroEspecieActivo;
            return true;
        }).map((item) => item.username!);

        return obtenerOpciones(usuarios);
    }, [datosDelRango, tipo, filtroEspecieActivo]);

    const opcionesEspecies = useMemo(() => {
        if (tipo !== "contactosPorPublicacion") return [];
        const especies = datosDelRango.filter((item) => {
            if (!item.especie) return false;
            return (filtroUsuarioActivo === "todos" || item.username === filtroUsuarioActivo);
        }).map((item) => item.especie!);
        return obtenerOpciones(especies);
    }, [datosDelRango, tipo, filtroUsuarioActivo]);

    const cambiarUsuario = (_: unknown, nuevaOpcion: OpcionFiltro | null) => {
        const nuevoUsername = nuevaOpcion?.valor ?? "todos";
        setFiltroEspecifico(nuevoUsername);
        if (filtroEspecieActivo !== "todos" && nuevoUsername !== "todos" && !datosDelRango.some((item) => item.username === nuevoUsername && item.especie === filtroEspecieActivo)) setFiltroEspecie("todos");
    };

    const cambiarEspecie = (_: unknown, nuevaOpcion: OpcionFiltro | null) => {
        const nuevaEspecie = nuevaOpcion?.valor ?? "todos";
        setFiltroEspecie(nuevaEspecie);
        if (filtroUsuarioActivo !== "todos" && nuevaEspecie !== "todos" && !datosDelRango.some((item) => item.username === filtroUsuarioActivo && item.especie === nuevaEspecie)) setFiltroEspecifico("todos");
    };

    const datosFiltrados = useMemo(() => {
        if (desdeCalculado > hastaCalculado) return [];
        const resultado: Array<{ fecha: number; cantidad: number }> = [];
        const [anioIni, mesIni, diaIni] = desdeCalculado.split("-").map(Number);
        const [anioFin, mesFin, diaFin] = hastaCalculado.split("-").map(Number);
        const current = new Date(anioIni, mesIni - 1, diaIni);
        const end = new Date(anioFin, mesFin - 1, diaFin);

        if (tipo === "cantidadPublicaciones") {
            const registrosPorUsuario = new Map<string, Array<{ fecha: string; cantidad: number }>>();
            datos.forEach((item) => {
                if (!item.username) return;
                if (filtroUsuarioActivo !== "todos" && item.username !== filtroUsuarioActivo) return;
                const fecha = obtenerFechaRegistroStr(item.fecha);
                if (fecha === null || fecha > hastaCalculado) return;
                const registros = registrosPorUsuario.get(item.username) ?? [];
                registros.push({fecha, cantidad: item.cantidad});
                registrosPorUsuario.set(item.username, registros);
            });

            registrosPorUsuario.forEach((registros) => { registros.sort((a, b) => a.fecha.localeCompare(b.fecha)); });
            const usuarios = Array.from(registrosPorUsuario.keys());
            const posiciones = new Map<string, number>();
            const ultimasCantidades = new Map<string, number>();

            usuarios.forEach((username) => { posiciones.set(username, 0); });
            while (current <= end) {
                const fechaStr = obtenerFechaLocalStr(current);
                let cantidadTotal = 0;
                usuarios.forEach((username) => {
                    const registros = registrosPorUsuario.get(username)!;
                    let posicion = posiciones.get(username)!;
                    while (posicion < registros.length && registros[posicion].fecha <= fechaStr) {
                        ultimasCantidades.set(username, registros[posicion].cantidad);
                        posicion++;
                    }
                    posiciones.set(username, posicion);
                    cantidadTotal += ultimasCantidades.get(username) ?? 0;
                });
                resultado.push({fecha: current.getTime(), cantidad: cantidadTotal});
                current.setDate(current.getDate() + 1);
            }
            return resultado;
        }

        const mapaCantidades = new Map<string, number>();
        datos.forEach((item) => {
            const fechaItem = obtenerFechaRegistroStr(item.fecha);
            if (fechaItem === null || fechaItem < desdeCalculado || fechaItem > hastaCalculado) return;
            if (tipo === "visitas" && filtroUsuarioActivo !== "todos" && item.tipoVisitante?.toLowerCase() !== filtroUsuarioActivo.toLowerCase()) return;
            if (tipo !== "visitas" && filtroUsuarioActivo !== "todos" && item.username !== filtroUsuarioActivo) return;
            if (tipo === "contactosPorPublicacion" && filtroEspecieActivo !== "todos" && item.especie !== filtroEspecieActivo) return;
            mapaCantidades.set(fechaItem, (mapaCantidades.get(fechaItem) ?? 0) + item.cantidad);
        });

        while (current <= end) {
            const fechaStr = obtenerFechaLocalStr(current);
            resultado.push({fecha: current.getTime(), cantidad: mapaCantidades.get(fechaStr) ?? 0});
            current.setDate(current.getDate() + 1);
        }

        return resultado;
    }, [datos, desdeCalculado, hastaCalculado, filtroUsuarioActivo, filtroEspecieActivo, tipo]);

    const ticksEjeX = useMemo(() => {
        const cantidadTicks = Math.min(5, datosFiltrados.length);
        if (cantidadTicks === 0) return [];
        const fechaInicial = datosFiltrados[0].fecha;
        const fechaFinal = datosFiltrados[datosFiltrados.length - 1].fecha;
        if (cantidadTicks === 1) return [fechaInicial];
        return Array.from({ length: cantidadTicks }, (_, i) => { return (fechaInicial + ((fechaFinal - fechaInicial) * i) / (cantidadTicks - 1)); });
    }, [datosFiltrados]);

    const totalHoy = useMemo(() => {
        if (tipo === "cantidadPublicaciones") return calcularCantidadPublicacionesHasta(datos, hoyStr, filtroUsuarioActivo);
        return datos.filter((item) => {
            const fechaItem = obtenerFechaRegistroStr(item.fecha);
            if (fechaItem !== hoyStr) return false;
            if (tipo === "visitas" && filtroUsuarioActivo !== "todos" && item.tipoVisitante?.toLowerCase() !== filtroUsuarioActivo.toLowerCase()) return false;
            if (tipo !== "visitas" && filtroUsuarioActivo !== "todos" && item.username !== filtroUsuarioActivo) return false;
            if (tipo === "contactosPorPublicacion" && filtroEspecieActivo !== "todos" && item.especie !== filtroEspecieActivo) return false;
            return true;
        }).reduce((acc, curr) => acc + curr.cantidad, 0);
    }, [datos, hoyStr, filtroUsuarioActivo, filtroEspecieActivo, tipo]);

    const totalRango = useMemo(() => {
        if (tipo === "cantidadPublicaciones") {
            if (datosFiltrados.length < 2) return 0;
            const cantidadInicial = datosFiltrados[0].cantidad;
            const cantidadFinal = datosFiltrados[datosFiltrados.length - 1].cantidad;
            return cantidadFinal - cantidadInicial;
        }
        return datosFiltrados.reduce((acc, curr) => acc + curr.cantidad, 0);
    }, [datosFiltrados, tipo]);

    const esCantidadPublicaciones = tipo === "cantidadPublicaciones";
    const variacionFormateada = totalRango > 0 ? `+${formateadorNumero.format(totalRango)}` : formateadorNumero.format(totalRango);

    return (
        <div className={styles.bloqueSeccion}>
            <div className={styles.encabezadoBloque}>
                <h3>{titulo}</h3>
                <p>Visualización estadística de{" "} {titulo.toLocaleLowerCase("es")}</p>
            </div>
            <div className={styles.contenedorFiltros}>
                {tipo === "visitas" ? (
                    <TextField className={styles.filtroVisitante} select label="Tipo de Visitante" size="small" value={filtroUsuarioActivo} onChange={(e) => setFiltroEspecifico(e.target.value)}>
                        <MenuItem value="todos">Todos</MenuItem>
                        <MenuItem value="comprador">Compradores</MenuItem>
                        <MenuItem value="operador">Operadores</MenuItem>
                        <MenuItem value="productor">Productores</MenuItem>
                    </TextField>
                ) : (
                    <Autocomplete
                        className={styles.filtroUsuario}
                        options={opcionesUsuarios}
                        getOptionLabel={(op) => op.etiqueta}
                        value={opcionesUsuarios.find((op) => op.valor === filtroUsuarioActivo) ?? null}
                        onChange={tipo === "contactosPorPublicacion" ? cambiarUsuario : (_, nuevaOpcion) => setFiltroEspecifico(nuevaOpcion?.valor ?? "todos")}
                        renderInput={(params) => (<TextField {...params} fullWidth label="Usuario" size="small" placeholder="Escribí para buscar..."/>)}
                        noOptionsText="No se encontraron usuarios"
                    />
                )}
                {tipo === "contactosPorPublicacion" && (
                    <Autocomplete
                        className={styles.filtroEspecie}
                        options={opcionesEspecies}
                        getOptionLabel={(op) => op.etiqueta}
                        value={opcionesEspecies.find((op) => op.valor === filtroEspecieActivo) ?? null}
                        onChange={cambiarEspecie}
                        renderInput={(params) => (<TextField {...params} fullWidth label="Especie" size="small" placeholder="Escribí para buscar..."/> )}
                        noOptionsText="No se encontraron especies"
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
                        <TextField className={styles.filtroFecha} type="date" label="Desde" size="small" value={fechaDesde} onChange={(e) => cambiarFechaDesde(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: fechaMaximaDesde } }}/>
                        <TextField className={styles.filtroFecha} type="date" label="Hasta" size="small" value={fechaHasta} onChange={(e) => cambiarFechaHasta(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: fechaMinimaHasta } }}/>
                    </div>
                )}
            </div>
            <div className={styles.tarjetasMetricas}>
                <div className={styles.tarjetaMetrica}>
                    <span className={styles.tituloTarjeta}>{esCantidadPublicaciones ? "Cantidad actual" : "Total de Hoy"}</span>
                    <div className={styles.detalleMetrica}>
                        <span>{titulo}</span>
                        <strong>{formateadorNumero.format(totalHoy)}</strong>
                    </div>
                </div>
                <div className={styles.tarjetaMetrica}>
                    <span className={styles.tituloTarjeta}>{esCantidadPublicaciones ? "Variación en el rango" : "Total del Rango Seleccionado"}</span>
                    <div className={styles.detalleMetrica}>
                        <span>{esCantidadPublicaciones ? "Cambio neto" : titulo}</span>
                        <strong>{esCantidadPublicaciones ? variacionFormateada : formateadorNumero.format(totalRango)}</strong>
                    </div>
                </div>
            </div>
            <div className={styles.contenedorGrafica}>
                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={datosFiltrados} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis type="number" dataKey="fecha" domain={["dataMin", "dataMax"]} ticks={ticksEjeX} interval={0} minTickGap={0} tick={{ className: styles.etiquetaEje }} padding={{ left: 0, right: 0 }}
                            tickFormatter={(val: unknown) => {
                                if (typeof val === "number") return new Date(val).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "2-digit" });
                                return "";
                            }}
                        />
                        <YAxis allowDecimals={false} domain={[0, "auto"]} tick={{ fontSize: 11 }}/>
                        <Tooltip trigger="hover" cursor={false} offset={10} isAnimationActive={false} separator=": "
                            labelFormatter={(label: unknown) => {
                                if (typeof label === "number") return `Fecha: ${new Date(label).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric"})}`;
                                return "";
                            }}
                            formatter={(value) => [formateadorNumero.format(Number(value ?? 0)), "Cantidad"]}
                        />
                        <Line type="linear" dataKey="cantidad" stroke="var(--color-secondary, #005d29)" strokeWidth={2} dot={false} activeDot={{ r: 5 }}/>
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
