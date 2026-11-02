"use client";

import { useState } from "react";
import { IconButton, MenuItem, Switch, TextField } from "@mui/material";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
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
    onGuardar: (configuracion: ConfiguracionOrdenamiento) => Promise<void>;
}

function sonIguales(primera: ConfiguracionOrdenamiento, segunda: ConfiguracionOrdenamiento) {
    return (primera.habilitado === segunda.habilitado && primera.ordenLanding === segunda.ordenLanding && primera.ordenMercadoVirtual === segunda.ordenMercadoVirtual && primera.ordenMercadoProduccion === segunda.ordenMercadoProduccion);
}

export default function TarjetaConfiguracionOrdenamiento({ configuracion, onGuardar }: TarjetaConfiguracionOrdenamientoProps) {
    const [valores, setValores] = useState(configuracion);
    const [guardado, setGuardado] = useState(configuracion);
    const [configuracionAnterior, setConfiguracionAnterior] = useState(configuracion);
    const [guardando, setGuardando] = useState(false);

    const { notificar } = useNotificacionToast();

    if (!sonIguales(configuracionAnterior, configuracion)) {
        setConfiguracionAnterior(configuracion);
        setValores(configuracion);
        setGuardado(configuracion);
    }

    const huboCambios = !sonIguales(valores, guardado);

    function cambiarOrden(campo: "ordenLanding" | "ordenMercadoVirtual" | "ordenMercadoProduccion", valor: string) {
        const opciones = campo === "ordenLanding" ? opcionesOrdenLanding : opcionesOrden;
        const opcion = opciones.find((opcion) => opcion.valor === valor);
        if (!opcion) {
            return;
        }
        setValores((actual) => ({...actual, [campo]: opcion.valor}));
    }

    async function guardar() {
        if (guardando || !huboCambios) {
            return;
        }
        setGuardando(true);
        try {
            await onGuardar(valores);
            setGuardado(valores);
            notificar("La configuración de ordenamiento se guardó correctamente.", "success");
        } catch (error) {
            notificar(error instanceof Error ? error.message : "No se pudo guardar la configuración de ordenamiento.", "error");
        } finally {
            setGuardando(false);
        }
    }

    const contenido = (
        <div className={styles.tarjeta}>
            <div className={styles.titulo}>Orden de las publicaciones</div>
            <span className={styles.descripcion}>Configurá el orden predeterminado de cada sección y si los usuarios pueden cambiarlo.</span>
            <div className={styles.filaSwitch} data-habilitado={valores.habilitado} data-guardando={guardando}>
                <div className={styles.textoSwitch}>
                    <span className={styles.etiquetaSwitch}>Permitir cambiar el orden</span>
                    <div className={styles.estadoSwitch}>
                        {valores.habilitado ? "Los usuarios pueden elegir cómo ordenar los resultados." : "Se utiliza únicamente el orden predeterminado."}
                    </div>
                </div>
                <Switch checked={valores.habilitado} disabled={guardando} className={styles.switch} onChange={(_, checked) => {setValores((actual) => ({...actual, habilitado: checked}))}} slotProps={{input: {role: "switch", "aria-label": "Permitir cambiar el orden"}}}/>
            </div>
            <div className={styles.filaEdicion}>
                <div className={styles.selectores}>
                    <TextField select fullWidth size="small" label="Orden predeterminado de Inicio" value={valores.ordenLanding} disabled={guardando} onChange={(evento) => cambiarOrden("ordenLanding", evento.target.value)} className={styles.selectMui}>
                        {opcionesOrdenLanding.map((opcion) => (
                            <MenuItem key={opcion.valor} value={opcion.valor} className={styles.opcionSelect}>
                                {opcion.etiqueta}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField select fullWidth size="small" label="Orden predeterminado de Mercado Virtual" value={valores.ordenMercadoVirtual} disabled={guardando} onChange={(evento) => cambiarOrden("ordenMercadoVirtual", evento.target.value)} className={styles.selectMui}>
                        {opcionesOrden.map((opcion) => (
                            <MenuItem key={opcion.valor} value={opcion.valor} className={styles.opcionSelect}>
                                {opcion.etiqueta}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField select fullWidth size="small" label="Orden predeterminado de Mercado Producción" value={valores.ordenMercadoProduccion} disabled={guardando} onChange={(evento) => cambiarOrden("ordenMercadoProduccion", evento.target.value)} className={styles.selectMui}>
                        {opcionesOrden.map((opcion) => (
                            <MenuItem key={opcion.valor} value={opcion.valor} className={styles.opcionSelect}>
                                {opcion.etiqueta}
                            </MenuItem>
                        ))}
                    </TextField>
                </div>
                <IconButton aria-label="Guardar configuración de ordenamiento" disabled={guardando || !huboCambios} onClick={guardar} className={styles.botonGuardar}>
                    <CheckOutlinedIcon />
                </IconButton>
            </div>
        </div>
    );
    return contenido; 
}