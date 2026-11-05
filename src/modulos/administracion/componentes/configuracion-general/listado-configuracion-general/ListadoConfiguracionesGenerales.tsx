"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import TarjetaInput from "../tarjetas-configuracion/input/TarjetaInput";
import TarjetaUploadFotoEspecie from "../tarjetas-configuracion/fotos-especies/TarjetaUploadFotoEspecie";
import { Divider } from "@mui/material";
import type { Especie } from "../tarjetas-configuracion/fotos-especies/TarjetaUploadFotoEspecie";
import { guardarFotoEspecie, eliminarFotoEspecie } from "@/modulos/administracion/acciones/foto-especie";
import { guardarConfiguraciones } from "@/modulos/administracion/acciones/guardar-configuracion";
import TarjetaOrdenamientoPredeterminado, { type ConfiguracionOrdenamiento, type OrdenPublicaciones } from "../tarjetas-configuracion/ordenamiento-predeterminado/TarjetaOrdenamientoPredeterminado";
import TarjetaVigencia, { type ConfiguracionVigenciaFotos } from "../tarjetas-configuracion/vigencia/TarjetaVigencia";
import TarjetaRestablecimientoContraseña from "../tarjetas-configuracion/restablecimiento-contraseña/TarjetaRestablecimientoContraseña";

interface ListadoConfiguracionesGeneralesProps {
    configuracion: Record<string, string | null>;
    especies: Especie[];
}

export default function ListadoConfiguracionesGenerales({ configuracion, especies }: ListadoConfiguracionesGeneralesProps) {
    const router = useRouter();
    const [especieSeleccionada, setEspecieSeleccionada] = useState("");
    const valorServer = configuracion.url_lista_inteligente ?? "";
    const [listaInteligente, setListaInteligente] = useState(valorServer);
    const [valorPropAnterior, setValorPropAnterior] = useState(valorServer);
   
    if (valorPropAnterior !== valorServer) {
        setValorPropAnterior(valorServer);
        setListaInteligente(valorServer);
    }
   
    const importeServer = configuracion.incremento_precio ?? "";
    const [importe, setImporte] = useState(importeServer);
    const [importePropAnterior, setImportePropAnterior] = useState(importeServer);
   
    if (importePropAnterior !== importeServer) {
        setImportePropAnterior(importeServer);
        setImporte(importeServer);
    }
    
    async function guardarListaInteligente(valor: string): Promise<void> {
        await guardarConfiguraciones({url_lista_inteligente: valor});
        setListaInteligente(valor);
        router.refresh();
    }

    async function guardarFoto(especieId: number, archivo: File): Promise<void> {
        await guardarFotoEspecie(especieId, archivo);
        router.refresh();
    }

    async function eliminarFoto(especieId: number): Promise<void> {
        await eliminarFotoEspecie(especieId);
        router.refresh();
    }

    async function guardarImporte(valor: string): Promise<void> {
        await guardarConfiguraciones({incremento_precio: valor});
        setImporte(valor);
        router.refresh();
    }

    function obtenerOrden(valor: string | null | undefined): OrdenPublicaciones {
        switch (valor) {
            case "menor_precio":
            case "mayor_precio":
            case "nombre_asc":
            case "nombre_desc":
            case "mas_vendidas":
            case "mas_actualizadas":
                return valor;
            default:
                return "mas_vendidas";
        }
    }

    const configuracionOrdenamiento: ConfiguracionOrdenamiento = {
        habilitado: configuracion.ordenamiento_habilitado === "true",
        ordenLanding: obtenerOrden(configuracion.orden_landing_page_default),
        ordenMercadoVirtual: obtenerOrden(configuracion.orden_mercado_virtual_default),
        ordenMercadoProduccion: obtenerOrden(configuracion.orden_mercado_produccion_default),
    };

    async function guardarOrdenamiento(valores: ConfiguracionOrdenamiento): Promise<void> {
        await guardarConfiguraciones({
            ordenamiento_habilitado: String(valores.habilitado),
            orden_landing_page_default: valores.ordenLanding,
            orden_mercado_virtual_default: valores.ordenMercadoVirtual,
            orden_mercado_produccion_default: valores.ordenMercadoProduccion,
        });
        router.refresh();
    }

    const configuracionVigenciaFotos: ConfiguracionVigenciaFotos = {
        habilitado: configuracion.aging_fotos_habilitado === "true",
        diasVigencia: configuracion.vigencia_fotos ?? "",
        avisosHabilitados: configuracion.aviso_vencimiento_fotos_habilitado === "true",
        diasAnticipacion: configuracion.anticipacion_aviso_fotos ?? "",
    };

    async function guardarVigenciaFotos(valores: ConfiguracionVigenciaFotos): Promise<void> {
        await guardarConfiguraciones({
            aging_fotos_habilitado: String(valores.habilitado),
            vigencia_fotos: valores.diasVigencia,
            aviso_vencimiento_fotos_habilitado: String(valores.avisosHabilitados),
            anticipacion_aviso_fotos: valores.diasAnticipacion,
        });
        router.refresh();
    }

    const configuracionVigenciaPublicaciones: ConfiguracionVigenciaFotos = {
        habilitado: configuracion.vigencia_publicaciones_productor_habilitada === "true",
        diasVigencia: configuracion.vigencia_publicaciones_productor ?? "",
        avisosHabilitados: configuracion.aviso_vencimiento_publicaciones_productor_habilitado === "true",
        diasAnticipacion: configuracion.anticipacion_aviso_publicaciones_productor ?? "",
    };

    async function guardarVigenciaPublicaciones(valores: ConfiguracionVigenciaFotos): Promise<void> {
        await guardarConfiguraciones({
            vigencia_publicaciones_productor_habilitada: String(valores.habilitado),
            vigencia_publicaciones_productor: valores.diasVigencia,
            aviso_vencimiento_publicaciones_productor_habilitado: String(valores.avisosHabilitados),
            anticipacion_aviso_publicaciones_productor: valores.diasAnticipacion,
        });
        router.refresh();
    }

    const restablecimientoHabilitado = configuracion.restablecimiento_contrasena_habilitado === "true";

    async function guardarRestablecimiento(habilitado: boolean): Promise<void> {
        await guardarConfiguraciones({
            restablecimiento_contrasena_habilitado: String(habilitado),
        });
        router.refresh();
    }

    const contenido = (
        <div className="secciones-pagina" style={{ gap: "1rem" }}>
            <TarjetaInput
                titulo="Lista Inteligente"
                descripcion="Configurá la URL de acceso a la Lista Inteligente."
                tipo="url"
                valor={listaInteligente}
                mensajeExito="La URL de la Lista Inteligente se guardó correctamente."
                onChangeValor={setListaInteligente}
                onGuardarValor={guardarListaInteligente}
            />
            <Divider sx={{borderColor: "var(--color-border)", marginInline: "var(--padding-panel)"}}/>
            <TarjetaInput
                titulo="Importe de ajuste rápido de precios"
                descripcion="Configurá el importe utilizado para aumentar o disminuir rápidamente el precio de una publicación."
                tipo="numero"
                valor={importe}
                mensajeExito="El importe de ajuste rápido de precios se guardó correctamente."
                onChangeValor={setImporte}
                onGuardarValor={guardarImporte}
            />
            <Divider sx={{borderColor: "var(--color-border)", marginInline: "var(--padding-panel)"}}/>
            <TarjetaOrdenamientoPredeterminado
                configuracion={configuracionOrdenamiento}
                onGuardar={guardarOrdenamiento}
            />
            <Divider sx={{borderColor: "var(--color-border)", marginInline: "var(--padding-panel)"}}/>
            <TarjetaVigencia
                titulo="Vigencia de las fotos"
                descripcion="Configurá la vigencia de las fotos de publicaciones de operadores y productores y sus avisos de próximo vencimiento."
                etiquetaVencimiento="Vencimiento de fotos"
                ayudaVencimiento="Aplicar un período de vigencia a las fotos."
                ayudaAvisos="Notificar a operadores y productores."
                configuracion={configuracionVigenciaFotos}
                maximoDiasVigencia={36500}
                onGuardar={guardarVigenciaFotos}
            />
            <Divider sx={{borderColor: "var(--color-border)", marginInline: "var(--padding-panel)"}}/>
            <TarjetaVigencia
                titulo="Vigencia de publicaciones de productores"
                descripcion="Configurá la vigencia de las publicaciones de productores y sus avisos de próximo vencimiento."
                etiquetaVencimiento="Vencimiento de publicaciones"
                ayudaVencimiento="Aplicar un período de vigencia a las publicaciones de productores."
                ayudaAvisos="Notificar a los productores."
                configuracion={configuracionVigenciaPublicaciones}
                onGuardar={guardarVigenciaPublicaciones}
            />
            <Divider sx={{borderColor: "var(--color-border)", marginInline: "var(--padding-panel)"}}/>
            <TarjetaRestablecimientoContraseña
                titulo="Restablecimiento de contraseñas"
                descripcion="Configurá si los usuarios pueden restablecer su propia contraseña."
                etiqueta="Permitir que los usuarios restablezcan su propia contraseña"
                habilitado={restablecimientoHabilitado}
                onGuardar={guardarRestablecimiento}
            />
            <Divider sx={{borderColor: "var(--color-border)", marginInline: "var(--padding-panel)"}}/>
            <TarjetaUploadFotoEspecie
                titulo="Fotos de especies"
                especies={especies}
                especieSeleccionada={especieSeleccionada}
                onChangeEspecie={setEspecieSeleccionada}
                onGuardarFoto={guardarFoto}
                onEliminarFoto={eliminarFoto}
            />
        </div>
    );
    return contenido; 
}
