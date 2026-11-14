"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import TarjetaInput from "../tarjetas-configuracion/input/TarjetaInput";
import TarjetaUploadFotoEspecie from "../tarjetas-configuracion/fotos-especies/TarjetaUploadFotoEspecie";
import { Divider } from "@mui/material";
import type { Especie } from "../tarjetas-configuracion/fotos-especies/TarjetaUploadFotoEspecie";
import { guardarFotoEspecie, eliminarFotoEspecie } from "@/modulos/administracion/acciones/foto-especie";
import { guardarConfiguraciones } from "@/modulos/administracion/acciones/guardar-configuracion";
import { CLAVES_VIGENCIA_PUBLICACIONES, MAXIMO_DIAS_ANTICIPACION_PUBLICACIONES, type TipoPropietarioPublicacion } from "@/modulos/publicaciones/claves-vigencia-publicaciones";
import { CLAVES_AGING_FOTOS, type TipoPropietarioFoto } from "@/modulos/publicaciones/claves-aging-fotos";
import { CLAVE_ANTICIPACION_AVISO_LOCALES, DIAS_ANTICIPACION_AVISO_LOCALES, validarAnticipacionAvisoLocales } from "@/modulos/usuarios/operadores/configuracion-avisos-locales";
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

    const anticipacionLocalesServer = configuracion[CLAVE_ANTICIPACION_AVISO_LOCALES] ?? String(DIAS_ANTICIPACION_AVISO_LOCALES);
    const [anticipacionLocales, setAnticipacionLocales] = useState(anticipacionLocalesServer);
    const [anticipacionLocalesAnterior, setAnticipacionLocalesAnterior] = useState(anticipacionLocalesServer);

    if (anticipacionLocalesAnterior !== anticipacionLocalesServer) {
        setAnticipacionLocalesAnterior(anticipacionLocalesServer);
        setAnticipacionLocales(anticipacionLocalesServer);
    }
   
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

    async function guardarAnticipacionLocales(valor: string): Promise<void> {
        await guardarConfiguraciones({ [CLAVE_ANTICIPACION_AVISO_LOCALES]: valor });
        setAnticipacionLocales(valor);
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

    function obtenerVigenciaFotos(tipo: TipoPropietarioFoto): ConfiguracionVigenciaFotos {
        const [habilitado, vigencia, avisos, anticipacion] = CLAVES_AGING_FOTOS[tipo];
        return {
            habilitado: configuracion[habilitado] === "true",
            diasVigencia: configuracion[vigencia] ?? "",
            avisosHabilitados: configuracion[avisos] === "true",
            diasAnticipacion: configuracion[anticipacion] ?? "",
        };
    }

    async function guardarVigenciaFotos(tipo: TipoPropietarioFoto, valores: ConfiguracionVigenciaFotos): Promise<void> {
        const [habilitado, vigencia, avisos, anticipacion] = CLAVES_AGING_FOTOS[tipo];
        await guardarConfiguraciones({
            [habilitado]: String(valores.habilitado),
            [vigencia]: valores.diasVigencia,
            [avisos]: String(valores.avisosHabilitados),
            [anticipacion]: valores.diasAnticipacion,
        });
        router.refresh();
    }

    function obtenerVigenciaPublicaciones(tipo: TipoPropietarioPublicacion): ConfiguracionVigenciaFotos {
        const [habilitada, vigencia, avisos, anticipacion] = CLAVES_VIGENCIA_PUBLICACIONES[tipo];
        return {
            habilitado: configuracion[habilitada] === "true",
            diasVigencia: configuracion[vigencia] ?? "",
            avisosHabilitados: configuracion[avisos] === "true",
            diasAnticipacion: configuracion[anticipacion] ?? "",
        };
    }

    async function guardarVigenciaPublicaciones(tipo: TipoPropietarioPublicacion, valores: ConfiguracionVigenciaFotos): Promise<void> {
        const [habilitada, vigencia, avisos, anticipacion] = CLAVES_VIGENCIA_PUBLICACIONES[tipo];
        await guardarConfiguraciones({
            [habilitada]: String(valores.habilitado),
            [vigencia]: valores.diasVigencia,
            [avisos]: String(valores.avisosHabilitados),
            [anticipacion]: valores.diasAnticipacion,
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
                titulo="Vigencia de fotos de operadores"
                descripcion="Configurá la vigencia de las fotos de publicaciones de operadores y sus avisos de próximo vencimiento."
                etiquetaVencimiento="Vencimiento de fotos"
                ayudaVencimiento="Aplicar un período de vigencia a las fotos de operadores."
                ayudaAvisos="Notificar a los operadores."
                configuracion={obtenerVigenciaFotos("OPERADOR")}
                maximoDiasVigencia={36500}
                onGuardar={(valores) => guardarVigenciaFotos("OPERADOR", valores)}
            />
            <Divider sx={{borderColor: "var(--color-border)", marginInline: "var(--padding-panel)"}}/>
            <TarjetaVigencia
                titulo="Vigencia de fotos de productores"
                descripcion="Configurá la vigencia de las fotos de publicaciones de productores y sus avisos de próximo vencimiento."
                etiquetaVencimiento="Vencimiento de fotos"
                ayudaVencimiento="Aplicar un período de vigencia a las fotos de productores."
                ayudaAvisos="Notificar a los productores."
                configuracion={obtenerVigenciaFotos("PRODUCTOR")}
                maximoDiasVigencia={36500}
                onGuardar={(valores) => guardarVigenciaFotos("PRODUCTOR", valores)}
            />
            <Divider sx={{borderColor: "var(--color-border)", marginInline: "var(--padding-panel)"}}/>
            <TarjetaVigencia
                titulo="Vigencia de publicaciones de operadores"
                avisosIndependientes
                maximoDiasAnticipacion={MAXIMO_DIAS_ANTICIPACION_PUBLICACIONES}
                descripcion="Configurá el plazo predeterminado y máximo de las publicaciones de operadores y sus avisos de próximo vencimiento."
                etiquetaVencimiento="Vencimiento de publicaciones"
                ayudaVencimiento="Al guardar, las publicaciones sin fecha reciben el plazo y las fechas posteriores se acortan. Las fechas anteriores se conservan. Desactivar mantiene las fechas existentes."
                ayudaAvisos="Notificar según la fecha de cada publicación, aunque el vencimiento administrativo esté desactivado."
                configuracion={obtenerVigenciaPublicaciones("OPERADOR")}
                onGuardar={(valores) => guardarVigenciaPublicaciones("OPERADOR", valores)}
            />
            <Divider sx={{borderColor: "var(--color-border)", marginInline: "var(--padding-panel)"}}/>
            <TarjetaVigencia
                titulo="Vigencia de publicaciones de productores"
                avisosIndependientes
                maximoDiasAnticipacion={MAXIMO_DIAS_ANTICIPACION_PUBLICACIONES}
                descripcion="Configurá el plazo predeterminado y máximo de las publicaciones de productores y sus avisos de próximo vencimiento."
                etiquetaVencimiento="Vencimiento de publicaciones"
                ayudaVencimiento="Al guardar, las publicaciones sin fecha reciben el plazo y las fechas posteriores se acortan. Las fechas anteriores se conservan. Desactivar mantiene las fechas existentes."
                ayudaAvisos="Notificar según la fecha de cada publicación, aunque el vencimiento administrativo esté desactivado."
                configuracion={obtenerVigenciaPublicaciones("PRODUCTOR")}
                onGuardar={(valores) => guardarVigenciaPublicaciones("PRODUCTOR", valores)}
            />
            <Divider sx={{borderColor: "var(--color-border)", marginInline: "var(--padding-panel)"}}/>
            <TarjetaInput
                titulo="Avisos de vencimiento de locales"
                descripcion="Días de anticipación para avisar a los administradores del vencimiento de un contrato de local. Entre 0 y 365. Con 0 se avisa el día del vencimiento."
                label="Días de anticipación del aviso de locales"
                valor={anticipacionLocales}
                validarNumero={validarAnticipacionAvisoLocales}
                mensajeExito="La anticipación de los avisos de locales se guardó correctamente."
                onChangeValor={setAnticipacionLocales}
                onGuardarValor={guardarAnticipacionLocales}
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
