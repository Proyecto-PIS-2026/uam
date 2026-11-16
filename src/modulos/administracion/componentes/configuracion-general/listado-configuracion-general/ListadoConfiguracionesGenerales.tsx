"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircularProgress, Divider } from "@mui/material";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import { guardarFotoEspecie, eliminarFotoEspecie } from "@/modulos/administracion/acciones/foto-especie";
import { guardarConfiguraciones } from "@/modulos/administracion/acciones/guardar-configuracion";
import { CLAVES_VIGENCIA_PUBLICACIONES } from "@/modulos/publicaciones/claves-vigencia-publicaciones";
import { CLAVES_AGING_FOTOS } from "@/modulos/publicaciones/claves-aging-fotos";
import { CLAVE_ANTICIPACION_AVISO_LOCALES, CLAVE_HABILITACION_AVISO_LOCALES } from "@/modulos/usuarios/operadores/configuracion-avisos-locales";
import TarjetaInput from "../tarjetas-configuracion/input/TarjetaInput";
import TarjetaUploadFotoEspecie, { type Especie } from "../tarjetas-configuracion/fotos-especies/TarjetaUploadFotoEspecie";
import TarjetaAvisosLocales, { type ConfiguracionAvisosLocalesFormulario } from "../tarjetas-configuracion/avisos-locales/TarjetaAvisosLocales";
import TarjetaOrdenamientoPredeterminado, { type ConfiguracionOrdenamiento, type OrdenPublicaciones } from "../tarjetas-configuracion/ordenamiento-predeterminado/TarjetaOrdenamientoPredeterminado";
import TarjetaVigencia, { type ConfiguracionVigenciaFotos } from "../tarjetas-configuracion/vigencia/TarjetaVigencia";
import TarjetaRestablecimientoContraseña from "../tarjetas-configuracion/restablecimiento-contraseña/TarjetaRestablecimientoContraseña";
import { normalizarConfiguracion, validarBorradorConfiguracion } from "./borrador-configuracion";
import { useBorradorConfiguracion } from "./useBorradorConfiguracion";
import styles from "./ListadoConfiguracionesGenerales.module.css";

interface Props {
    configuracion: Record<string, string | null>;
    especies: Especie[];
}

const clavesOrdenamiento: Record<keyof ConfiguracionOrdenamiento, string> = {
    habilitado: "ordenamiento_habilitado",
    ordenLanding: "orden_landing_page_default",
    ordenMercadoVirtual: "orden_mercado_virtual_default",
    ordenMercadoProduccion: "orden_mercado_produccion_default",
};
const clavesLocales: Record<keyof ConfiguracionAvisosLocalesFormulario, string> = {
    habilitado: CLAVE_HABILITACION_AVISO_LOCALES,
    diasAnticipacion: CLAVE_ANTICIPACION_AVISO_LOCALES,
};

function clavesVigencia([habilitado, diasVigencia, avisosHabilitados, diasAnticipacion]: readonly string[]): Record<keyof ConfiguracionVigenciaFotos, string> {
    return { habilitado, diasVigencia, avisosHabilitados, diasAnticipacion };
}

const seccionesVigencia = [
    { titulo: "Vigencia de fotos de operadores", etiqueta: "Vencimiento de fotos", claves: clavesVigencia(CLAVES_AGING_FOTOS.OPERADOR), avisosIndependientes: false },
    { titulo: "Vigencia de fotos de productores", etiqueta: "Vencimiento de fotos", claves: clavesVigencia(CLAVES_AGING_FOTOS.PRODUCTOR), avisosIndependientes: false },
    { titulo: "Vigencia de publicaciones de operadores", etiqueta: "Vencimiento de publicaciones", claves: clavesVigencia(CLAVES_VIGENCIA_PUBLICACIONES.OPERADOR), avisosIndependientes: true },
    { titulo: "Vigencia de publicaciones de productores", etiqueta: "Vencimiento de publicaciones", claves: clavesVigencia(CLAVES_VIGENCIA_PUBLICACIONES.PRODUCTOR), avisosIndependientes: true },
];

function Separador() {
    return <Divider sx={{ borderColor: "var(--color-border)", marginInline: "var(--padding-panel)" }} />;
}

export default function ListadoConfiguracionesGenerales({ configuracion, especies }: Props) {
    const router = useRouter();
    const { notificar } = useNotificacionToast();
    const borrador = useBorradorConfiguracion(normalizarConfiguracion(configuracion));
    const { valores, guardado, cambios } = borrador;
    const [especieSeleccionada, setEspecieSeleccionada] = useState("");
    const [fotosPendientes, setFotosPendientes] = useState<Record<number, File | null>>({});
    const [fotosGuardadas, setFotosGuardadas] = useState<Record<number, { archivo: File | null; fotoAnterior: string | null }>>({});
    const [errores, setErrores] = useState<Record<string, boolean>>({});
    const [guardando, setGuardando] = useState(false);
    const guardandoRef = useRef(false);
    const hayCambios = Object.keys(cambios).length > 0 || Object.keys(fotosPendientes).length > 0;

    const fotosPorActualizar = Object.entries(fotosGuardadas).filter(([id, foto]) => {
        const especie = especies.find((actual) => actual.id === Number(id));
        return especie && especie.fotoEspecie === foto.fotoAnterior;
    });
    if (fotosPorActualizar.length !== Object.keys(fotosGuardadas).length) {
        setFotosGuardadas(Object.fromEntries(fotosPorActualizar));
    }
    const fotosConfirmadas = Object.fromEntries(fotosPorActualizar.map(([id, foto]) => [id, foto.archivo]));

    function cambiar(cambiosNuevos: Record<string, string>) {
        if (guardandoRef.current) return;
        borrador.cambiar(cambiosNuevos);
        const siguientes = { ...valores, ...cambiosNuevos };
        const pendientes = Object.fromEntries(Object.entries(siguientes).filter(([clave, valor]) => valor !== guardado[clave]));
        const erroresActuales = validarBorradorConfiguracion(siguientes, pendientes).errores;
        setErrores((actuales) => {
            return Object.fromEntries(Object.keys(actuales).filter((clave) => erroresActuales[clave]).map((clave) => [clave, true]));
        });
    }

    function cambiarCampos<T extends object>(campos: Partial<T>, claves: Record<keyof T, string>) {
        const entradas = (Object.keys(campos) as (keyof T)[])
            .filter((campo) => campos[campo] !== undefined)
            .map((campo) => [claves[campo], String(campos[campo])]);
        cambiar(Object.fromEntries(entradas));
    }

    function marcas<T extends object>(claves: Record<keyof T, string>, error = false): Partial<Record<keyof T, boolean>> {
        return Object.fromEntries((Object.keys(claves) as (keyof T)[]).map((campo) => [
            campo, error ? Boolean(errores[claves[campo]]) : valores[claves[campo]] !== guardado[claves[campo]],
        ])) as Partial<Record<keyof T, boolean>>;
    }

    function cambiarFoto(id: number, archivo: File | null | undefined) {
        if (guardandoRef.current) return;
        setFotosPendientes((actuales) => {
            const siguientes = { ...actuales };
            if (archivo === undefined) delete siguientes[id];
            else siguientes[id] = archivo;
            return siguientes;
        });
    }

    function cancelar() {
        if (guardandoRef.current) return;
        borrador.cancelar();
        setFotosPendientes({});
        setErrores({});
    }

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (guardandoRef.current || !hayCambios) return;
        const validacion = validarBorradorConfiguracion(valores, cambios);
        setErrores(validacion.errores);
        if (validacion.mensaje) {
            notificar(validacion.mensaje, "error");
            return;
        }
        guardandoRef.current = true;
        setGuardando(true);
        let guardoAlgo = false;
        try {
            if (Object.keys(validacion.cambios).length > 0) {
                await guardarConfiguraciones(validacion.cambios);
                borrador.confirmar(validacion.cambios);
                guardoAlgo = true;
            }
            for (const [identificador, archivo] of Object.entries(fotosPendientes)) {
                const id = Number(identificador);
                if (archivo === null) await eliminarFotoEspecie(id);
                else await guardarFotoEspecie(id, archivo);
                guardoAlgo = true;
                const fotoAnterior = especies.find((especie) => especie.id === id)?.fotoEspecie ?? null;
                setFotosGuardadas((actuales) => ({ ...actuales, [id]: { archivo, fotoAnterior } }));
                setFotosPendientes((actuales) => {
                    const siguientes = { ...actuales };
                    delete siguientes[id];
                    return siguientes;
                });
            }
            notificar("La configuración se guardó correctamente.", "success");
        } catch (error) {
            const detalle = error instanceof Error ? error.message : "No se pudo guardar la configuración.";
            notificar((guardoAlgo ? "Se guardaron algunos cambios. " : "") + detalle, "error");
        } finally {
            guardandoRef.current = false;
            setGuardando(false);
            if (guardoAlgo) router.refresh();
        }
    }

    const configuracionOrdenamiento: ConfiguracionOrdenamiento = {
        habilitado: valores.ordenamiento_habilitado === "true",
        ordenLanding: valores.orden_landing_page_default as OrdenPublicaciones,
        ordenMercadoVirtual: valores.orden_mercado_virtual_default as OrdenPublicaciones,
        ordenMercadoProduccion: valores.orden_mercado_produccion_default as OrdenPublicaciones,
    };

    return (
        <form className={styles.formulario} aria-label="Configuración general" aria-busy={guardando} noValidate onSubmit={guardar}>
            <div className="secciones-pagina" style={{ gap: "1rem" }}>
                <TarjetaInput
                    titulo="Lista Inteligente"
                    descripcion="Configurá la URL de acceso a la Lista Inteligente."
                    tipo="url"
                    valor={valores.url_lista_inteligente}
                    onChangeValor={(valor) => cambiar({ url_lista_inteligente: valor })}
                    guardando={guardando}
                    modificado={valores.url_lista_inteligente !== guardado.url_lista_inteligente}
                    error={errores.url_lista_inteligente}
                />
                <Separador />
                <TarjetaInput
                    titulo="Importe de ajuste rápido de precios"
                    descripcion="Configurá el importe utilizado para aumentar o disminuir rápidamente el precio de una publicación."
                    tipo="numero"
                    valor={valores.incremento_precio}
                    onChangeValor={(valor) => cambiar({ incremento_precio: valor })}
                    guardando={guardando}
                    modificado={valores.incremento_precio !== guardado.incremento_precio}
                    error={errores.incremento_precio}
                />
                <Separador />
                <TarjetaOrdenamientoPredeterminado
                    configuracion={configuracionOrdenamiento}
                    onChange={(campos) => cambiarCampos<ConfiguracionOrdenamiento>(campos, clavesOrdenamiento)}
                    guardando={guardando}
                    modificados={marcas<ConfiguracionOrdenamiento>(clavesOrdenamiento)}
                />
                <Separador />
                {seccionesVigencia.map(({ titulo, etiqueta, claves, avisosIndependientes }) => (
                    <div key={titulo}>
                        <TarjetaVigencia
                            titulo={titulo}
                            etiquetaVencimiento={etiqueta}
                            avisosIndependientes={avisosIndependientes}
                            configuracion={{
                                habilitado: valores[claves.habilitado] === "true",
                                diasVigencia: valores[claves.diasVigencia],
                                avisosHabilitados: valores[claves.avisosHabilitados] === "true",
                                diasAnticipacion: valores[claves.diasAnticipacion],
                            }}
                            onChange={(campos) => cambiarCampos<ConfiguracionVigenciaFotos>(campos, claves)}
                            guardando={guardando}
                            modificados={marcas<ConfiguracionVigenciaFotos>(claves)}
                            errores={marcas<ConfiguracionVigenciaFotos>(claves, true)}
                        />
                        <Separador />
                    </div>
                ))}
                <TarjetaAvisosLocales
                    configuracion={{
                        habilitado: valores[CLAVE_HABILITACION_AVISO_LOCALES] === "true",
                        diasAnticipacion: valores[CLAVE_ANTICIPACION_AVISO_LOCALES],
                    }}
                    onChange={(campos) => cambiarCampos<ConfiguracionAvisosLocalesFormulario>(campos, clavesLocales)}
                    guardando={guardando}
                    modificados={marcas<ConfiguracionAvisosLocalesFormulario>(clavesLocales)}
                    errores={marcas<ConfiguracionAvisosLocalesFormulario>(clavesLocales, true)}
                />
                <Separador />
                <TarjetaRestablecimientoContraseña
                    titulo="Restablecimiento de contraseñas"
                    etiqueta="Permitir que los usuarios restablezcan su propia contraseña"
                    habilitado={valores.restablecimiento_contrasena_habilitado === "true"}
                    onChange={(habilitado) => cambiar({ restablecimiento_contrasena_habilitado: String(habilitado) })}
                    guardando={guardando}
                    modificado={valores.restablecimiento_contrasena_habilitado !== guardado.restablecimiento_contrasena_habilitado}
                />
                <Separador />
                <TarjetaUploadFotoEspecie
                    titulo="Fotos de especies"
                    especies={especies}
                    especieSeleccionada={especieSeleccionada}
                    onChangeEspecie={setEspecieSeleccionada}
                    cambios={fotosPendientes}
                    confirmadas={fotosConfirmadas}
                    onChangeFoto={cambiarFoto}
                    guardando={guardando}
                />
                {(hayCambios || guardando) && (
                    <div className={styles.acciones} data-acciones-flotantes role="group" aria-label="Acciones de configuración">
                        <button type="button" className={styles.cancelar} disabled={guardando} onClick={cancelar}>Cancelar</button>
                        <button type="submit" formNoValidate aria-label="Guardar" className={styles.guardar} disabled={guardando}>
                            {guardando && <CircularProgress size={18} color="inherit" aria-label="Guardando configuración" />}
                            Guardar
                        </button>
                    </div>
                )}
            </div>
        </form>
    );
}
