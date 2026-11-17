"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { fetchConSesion } from "../../../identidad-acceso/autenticacion/cliente-sesion";
import { useNotificacionToast } from "../../../../compartido/componentes/NotificacionToast";
import type { PublicacionMiMercadoProductor } from "../tipos";
import type { OpcionesEdicionPublicacion } from "../../catalogos/tipos";
import { crearBorrador, prepararCambiosPublicacionProductor, type BorradorPublicacionProductor } from "../borrador-edicion-productor";

export type ParametrosEdicionProductor = {
    publicacion: PublicacionMiMercadoProductor | null;
    alCerrar: () => void;
    alEliminada?: (mensaje: string, tipo: "success" | "info") => void;
    alGuardar?: (publicacion: PublicacionMiMercadoProductor) => void;
};

type Estado = {
    id: number | null;
    sesion: object;
    guardada: { original: PublicacionMiMercadoProductor; nueva: PublicacionMiMercadoProductor } | null;
    edicion: { base: PublicacionMiMercadoProductor; opciones: OpcionesEdicionPublicacion; borrador: BorradorPublicacionProductor } | null;
    cargaPara: PublicacionMiMercadoProductor | null;
    confirmacionPara: PublicacionMiMercadoProductor | null;
    guardando: boolean;
    eliminando: boolean;
    fotoPreparada: boolean;
    fotoAmpliada: boolean;
};

function estadoInicial(publicacion: ParametrosEdicionProductor["publicacion"]): Estado {
    return {
        id: publicacion?.id ?? null, sesion: {}, guardada: null, edicion: null,
        cargaPara: null, confirmacionPara: null, guardando: false, eliminando: false,
        fotoPreparada: !publicacion?.foto?.trim(), fotoAmpliada: false,
    };
}

export function useEdicionPublicacionProductor({ publicacion: recibida, alCerrar, alGuardar, alEliminada }: ParametrosEdicionProductor) {
    const [estado, setEstado] = useState(() => estadoInicial(recibida));
    const { notificar, cerrarNotificacion } = useNotificacionToast();
    const sesionRef = useRef<object | null>(null);
    const operacionRef = useRef<object | null>(null);
    const solicitudOpcionesRef = useRef<object | null>(null);
    const recibidaRef = useRef(recibida);
    const alGuardarRef = useRef(alGuardar);

    if (estado.id !== (recibida?.id ?? null)) {
        setEstado(estadoInicial(recibida));
    } else if (recibida && !estado.fotoPreparada && !recibida.foto?.trim()) {
        setEstado({ ...estado, fotoPreparada: true });
    }

    const vigente = estado.guardada?.original === recibida ? estado.guardada.nueva : recibida;
    const edicion = estado.edicion;
    const publicacion = edicion?.base ?? vigente;
    const borrador = edicion?.borrador;
    const editando = edicion !== null;
    const ocupado = estado.guardando || estado.eliminando;
    const cargando = vigente !== null && estado.cargaPara === vigente;
    const confirmando = vigente !== null && estado.confirmacionPara === vigente;
    const fotoVisible = borrador ? borrador.vistaPrevia ?? borrador.foto : publicacion?.foto;
    const tieneFoto = Boolean(fotoVisible?.trim());
    if (estado.id === (recibida?.id ?? null) && estado.fotoAmpliada && !tieneFoto) {
        setEstado({ ...estado, fotoAmpliada: false });
    }
    const abierto = recibida !== null && (estado.fotoPreparada || !tieneFoto);
    const tituloId = publicacion ? `publicacion-productor-${publicacion.id}-titulo` : undefined;
    const variedad = publicacion?.variedad;
    const especie = publicacion?.especie;
    const especieId = borrador?.especieId ?? especie?.id;
    const variedades = edicion?.opciones.variedades.filter((opcion) => opcion.especieId === especieId) ?? [];
    const envases = edicion?.opciones.envases ?? [];
    const kilos = edicion?.opciones.kilos ?? [];
    const categorias = edicion?.opciones.categorias ?? [];
    const nombreEnvase = borrador?.envaseId === 0 ? null : envases.find((opcion) => opcion.id === borrador?.envaseId)?.nombre ?? publicacion?.envase?.nombreEnvase;
    const disponible = borrador?.disponible ?? publicacion?.publicacionDisponible;
    const fechaFormateada = publicacion ? new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Montevideo" }).format(new Date(publicacion.fecha)) : "";
    const vistaPrevia = borrador?.vistaPrevia;

    useEffect(() => {
        sesionRef.current = estado.sesion;
        return () => { sesionRef.current = null; };
    }, [estado.sesion]);

    useEffect(() => {
        recibidaRef.current = recibida;
        return () => { solicitudOpcionesRef.current = null; };
    }, [recibida]);

    useEffect(() => {
        alGuardarRef.current = alGuardar;
    }, [alGuardar]);

    useEffect(() => () => {
        if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    }, [vistaPrevia]);

    function cerrar() {
        solicitudOpcionesRef.current = null;
        sesionRef.current = null;
        setEstado(estadoInicial(recibida));
        alCerrar();
    }

    function solicitarCierre() {
        if (operacionRef.current === estado.sesion) return;
        if (confirmando) {
            setEstado((actual) => ({ ...actual, confirmacionPara: null }));
            return;
        }
        cerrar();
    }

    function cambiar(cambios: Partial<BorradorPublicacionProductor>) {
        if (operacionRef.current === estado.sesion) return;
        cerrarNotificacion();
        setEstado((actual) => actual.edicion ? {
            ...actual, edicion: { ...actual.edicion, borrador: { ...actual.edicion.borrador, ...cambios } },
        } : actual);
    }

    function cambiarEspecie(nuevaEspecieId: number) {
        if (!edicion || !borrador) return;
        cambiar({
            especieId: nuevaEspecieId,
            variedadId: 0,
        });
    }

    function cambiarVariedad(nuevaVariedadId: number) {
        if (!edicion) return;
        cambiar({ variedadId: nuevaVariedadId });
    }

    function escribirCantidadUnidades(valor: string) {
        if (valor === "") cambiar({ cantidadUnidades: "" });
        else if (/^\d+$/.test(valor) && Number(valor) <= 2147483647) cambiar({ cantidadUnidades: String(Number(valor)) });
    }

    function cancelarEdicion() {
        if (operacionRef.current === estado.sesion) return;
        cerrarNotificacion();
        setEstado((actual) => ({ ...actual, edicion: null }));
    }

    function seleccionarFoto(evento: ChangeEvent<HTMLInputElement>) {
        const archivo = evento.target.files?.[0];
        evento.target.value = "";
        if (!archivo || !editando || operacionRef.current === estado.sesion) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type) || archivo.size === 0 || archivo.size > 10 * 1024 * 1024) {
            notificar("Seleccioná una imagen JPEG, PNG o WebP de hasta 10 MB.", "error");
            return;
        }
        cambiar({ archivo, vistaPrevia: URL.createObjectURL(archivo) });
    }

    async function comenzarEdicion() {
        if (!vigente || editando || cargando || operacionRef.current === estado.sesion || confirmando) return;
        const solicitud = {};
        solicitudOpcionesRef.current = solicitud;
        setEstado((actual) => ({ ...actual, cargaPara: vigente }));
        try {
            const respuesta = await fetchConSesion(`/api/publicaciones/productor/${vigente.publicacionProductorId}`, { cache: "no-store" });
            const resultado = await respuesta.json();
            if (solicitud !== solicitudOpcionesRef.current) return;
            if (!respuesta.ok) {
                notificar(resultado.errores?.join("\n") || "No se pudo cargar la edición.", "error");
                return;
            }
            setEstado((actual) => ({ ...actual, fotoAmpliada: false, edicion: { base: vigente, opciones: resultado.opciones, borrador: crearBorrador(vigente) } }));
        } catch {
            if (solicitud === solicitudOpcionesRef.current) notificar("No se pudo cargar la edición. Intentá nuevamente.", "error");
        } finally {
            if (solicitud === solicitudOpcionesRef.current) setEstado((actual) => ({ ...actual, cargaPara: null }));
        }
    }

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (!edicion || !borrador || operacionRef.current === estado.sesion) return;
        const resultadoValidacion = prepararCambiosPublicacionProductor(edicion.base, borrador, edicion.opciones);
        if (!resultadoValidacion.esValido) {
            notificar(resultadoValidacion.error, "error");
            return;
        }
        const { cambios, sinCambios } = resultadoValidacion;
        if (sinCambios) {
            setEstado((actual) => ({ ...actual, edicion: null }));
            return;
        }
        const formulario = new FormData();
        formulario.set("cambios", JSON.stringify(cambios));
        if (borrador.archivo) formulario.set("foto", borrador.archivo);
        const sesion = estado.sesion;
        operacionRef.current = sesion;
        setEstado((actual) => ({ ...actual, guardando: true }));
        try {
            const respuesta = await fetchConSesion(`/api/publicaciones/productor/${edicion.base.publicacionProductorId}`, { method: "PATCH", body: formulario });
            const resultado = await respuesta.json();
            if (sesionRef.current !== sesion) return;
            if (!respuesta.ok) {
                const mensajes = resultado.errores?.length ? resultado.errores : ["No se pudieron guardar los cambios."];
                notificar(mensajes.join("\n"), "error");
                return;
            }
            const original = recibidaRef.current;
            if (!original) return;
            setEstado((actual) => ({ ...actual, guardada: { original, nueva: resultado.publicacion }, edicion: null }));
            notificar("Cambios guardados.", "success");
            alGuardarRef.current?.(resultado.publicacion);
        } catch {
            if (sesionRef.current === sesion) notificar("No se pudieron guardar los cambios. Intentá nuevamente.", "error");
        } finally {
            if (operacionRef.current === sesion) operacionRef.current = null;
            if (sesionRef.current === sesion) setEstado((actual) => ({ ...actual, guardando: false }));
        }
    }

    function cancelarEliminacion() {
        if (operacionRef.current === estado.sesion) return;
        setEstado((actual) => ({ ...actual, confirmacionPara: null }));
    }

    async function eliminar() {
        if (!vigente || operacionRef.current === estado.sesion || cargando || editando) return;
        const sesion = estado.sesion;
        operacionRef.current = sesion;
        setEstado((actual) => ({ ...actual, eliminando: true }));
        try {
            const respuesta = await fetchConSesion(`/api/publicaciones/productor/${vigente.publicacionProductorId}`, { method: "DELETE" });
            const resultado = await respuesta.json().catch(() => ({}));
            if (!respuesta.ok && respuesta.status !== 404) throw new Error(resultado.errores?.join("\n") || "No se pudo eliminar la publicación.");
            const mensaje = respuesta.ok ? (resultado.mensaje ?? "Publicación eliminada correctamente.") : "La publicación ya había sido eliminada.";
            if (sesionRef.current === sesion) cerrar();
            alEliminada?.(mensaje, respuesta.ok ? "success" : "info");
        } catch (error) {
            if (sesionRef.current === sesion) {
                setEstado((actual) => ({ ...actual, confirmacionPara: null }));
                notificar(error instanceof Error ? error.message : "No se pudo conectar con el servidor.", "error");
            }
        } finally {
            if (operacionRef.current === sesion) operacionRef.current = null;
            if (sesionRef.current === sesion) setEstado((actual) => ({ ...actual, eliminando: false }));
        }
    }

    return {
        estado, setEstado, vigente, edicion, publicacion,
        borrador, editando, ocupado, cargando, confirmando,
        fotoVisible, tieneFoto, abierto, tituloId, variedad,
        especie, variedades, envases, kilos, categorias,
        nombreEnvase, disponible, fechaFormateada, solicitarCierre, cambiar,
        cambiarEspecie, cambiarVariedad, escribirCantidadUnidades, cancelarEdicion, seleccionarFoto,
        comenzarEdicion, guardar, eliminar, cancelarEliminacion,
    };
}
