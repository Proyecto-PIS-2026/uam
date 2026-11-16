"use client";

import { MenuItem, Switch, TextField } from "@mui/material";
import styles from "./TarjetaOrdenamientoPredeterminado.module.css";

const opcionesOrden = [
    { valor: "menor_precio", etiqueta: "Menor Precio" },
    { valor: "mayor_precio", etiqueta: "Mayor Precio" },
    { valor: "nombre_asc", etiqueta: "A-Z" },
    { valor: "nombre_desc", etiqueta: "Z-A" },
    { valor: "mas_vendidas", etiqueta: "Más vendidas" },
    { valor: "mas_actualizadas", etiqueta: "Más actualizadas" },
] as const;

const opcionesOrdenLanding = opcionesOrden.filter((opcion) => opcion.valor !== "menor_precio" && opcion.valor !== "mayor_precio" && opcion.valor !== "mas_actualizadas");

export type OrdenPublicaciones = typeof opcionesOrden[number]["valor"];

export interface ConfiguracionOrdenamiento {
    habilitado: boolean;
    ordenLanding: OrdenPublicaciones;
    ordenMercadoVirtual: OrdenPublicaciones;
    ordenMercadoProduccion: OrdenPublicaciones;
}

interface TarjetaConfiguracionOrdenamientoProps {
    configuracion: ConfiguracionOrdenamiento;
    onChange: (cambios: Partial<ConfiguracionOrdenamiento>) => void;
    guardando?: boolean;
    modificados?: Partial<Record<keyof ConfiguracionOrdenamiento, boolean>>;
    errores?: Partial<Record<keyof ConfiguracionOrdenamiento, boolean>>;
}

export default function TarjetaConfiguracionOrdenamiento({ configuracion, onChange, guardando = false, modificados = {}, errores = {} }: TarjetaConfiguracionOrdenamientoProps) {
    function cambiarOrden(campo: "ordenLanding" | "ordenMercadoVirtual" | "ordenMercadoProduccion", valor: string) {
        const opciones = campo === "ordenLanding" ? opcionesOrdenLanding : opcionesOrden;
        const opcion = opciones.find((opcion) => opcion.valor === valor);
        if (opcion) onChange({ [campo]: opcion.valor });
    }

    return (
        <div className={styles.tarjeta}>
            <div className={styles.titulo}>Orden de las publicaciones</div>
            <label className={styles.filaSwitch} data-habilitado={configuracion.habilitado} data-guardando={guardando}
                data-modificado={Boolean(modificados.habilitado)} data-error={Boolean(errores.habilitado)}>
                <span className={styles.textoSwitch}>
                    <span className={styles.etiquetaSwitch}>Permitir cambiar el orden</span>
                    <span className={styles.estadoSwitch}>
                        {configuracion.habilitado ? "Los usuarios pueden elegir cómo ordenar los resultados." : "Se utiliza únicamente el orden predeterminado."}
                    </span>
                </span>
                <Switch checked={configuracion.habilitado} disabled={guardando} className={styles.switch}
                    onChange={(_, habilitado) => onChange({ habilitado })}
                    slotProps={{ input: { role: "switch", "aria-label": "Permitir cambiar el orden", "aria-invalid": Boolean(errores.habilitado) } }}
                />
            </label>
            <TextField select fullWidth size="small" label="Orden predeterminado de Inicio" value={configuracion.ordenLanding} disabled={guardando}
                onChange={(evento) => cambiarOrden("ordenLanding", evento.target.value)} className={styles.selectMui}
                data-modificado={Boolean(modificados.ordenLanding)} error={Boolean(errores.ordenLanding)}>
                {opcionesOrdenLanding.map((opcion) => (
                    <MenuItem key={opcion.valor} value={opcion.valor} className={styles.opcionSelect}>{opcion.etiqueta}</MenuItem>
                ))}
            </TextField>
            <TextField select fullWidth size="small" label="Orden predeterminado de Mercado Virtual" value={configuracion.ordenMercadoVirtual} disabled={guardando}
                onChange={(evento) => cambiarOrden("ordenMercadoVirtual", evento.target.value)} className={styles.selectMui}
                data-modificado={Boolean(modificados.ordenMercadoVirtual)} error={Boolean(errores.ordenMercadoVirtual)}>
                {opcionesOrden.map((opcion) => (
                    <MenuItem key={opcion.valor} value={opcion.valor} className={styles.opcionSelect}>{opcion.etiqueta}</MenuItem>
                ))}
            </TextField>
            <TextField select fullWidth size="small" label="Orden predeterminado de Mercado Producción" value={configuracion.ordenMercadoProduccion} disabled={guardando}
                onChange={(evento) => cambiarOrden("ordenMercadoProduccion", evento.target.value)} className={styles.selectMui}
                data-modificado={Boolean(modificados.ordenMercadoProduccion)} error={Boolean(errores.ordenMercadoProduccion)}>
                {opcionesOrden.map((opcion) => (
                    <MenuItem key={opcion.valor} value={opcion.valor} className={styles.opcionSelect}>{opcion.etiqueta}</MenuItem>
                ))}
            </TextField>
        </div>
    );
}
