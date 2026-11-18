"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNotificacionToast } from "../../../../compartido/componentes/NotificacionToast";
import { compararPaisesPorPrioridad } from "../../../../compartido/prioridad-paises";
import type { CambiosPublicacionOperador, PublicacionParaEditar } from "../tipos";
import type { OpcionesEdicionPublicacion } from "../../catalogos/tipos";
import { MAXIMO_PRECIO_PUBLICACION, PRECIO_PUBLICACION_INVALIDO, esEntradaPrecioPublicacion, precioPublicacionValido } from "../../precio-publicacion";
import { precioParaEdicion, prepararCambiosPublicacionOperador } from "../borrador-edicion-publicacion";

type Parametros = OpcionesEdicionPublicacion & {
    publicacion: PublicacionParaEditar;
    alCerrar: () => void;
    alGuardar?: (id: number, cambios: CambiosPublicacionOperador, foto: File | null) => void | Promise<void>;
    modoInicial?: "consulta" | "edicion";
    puedeModificar?: boolean;
    eliminando?: boolean;
    actualizando?: boolean;
    guardando: boolean;
    setGuardando: (valor: boolean) => void;
};

const formatoCantidad = /^(0|[1-9]\d{0,9})$/;

export function useEdicionPublicacion({ alCerrar, alGuardar, publicacion: recibida, especies, variedades, categorias, calibres, envases, kilos, paises, modoInicial = "edicion", puedeModificar = true, eliminando = false, actualizando = false, guardando, setGuardando }: Parametros) {
    const { notificar, cerrarNotificacion } = useNotificacionToast();
    const [editando, setEditando] = useState(modoInicial === "edicion" && puedeModificar);
    const [fotoAmpliada, setFotoAmpliada] = useState(false);
    const [baseEdicion, setBaseEdicion] = useState(recibida);
    const [guardada, setGuardada] = useState<{ origen: PublicacionParaEditar; datos: PublicacionParaEditar } | null>(null);
    const vigente = guardada?.origen === recibida ? guardada.datos : recibida;
    const publicacion = editando ? baseEdicion : vigente;
    const [precioEditado, setPrecio] = useState(() => precioParaEdicion(publicacion.precio));
    const [cantidadUnidadesEditado, setCantidadUnidades] = useState(() => publicacion.cantidadUnidades == null ? "" : String(publicacion.cantidadUnidades));
    const [comentarioEditado, setComentario] = useState(() => publicacion.comentario ?? "");
    const [fotoEditado, setFoto] = useState(publicacion.foto);
    const [fotoNueva, setFotoNueva] = useState<File | null>(null);
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
    const [especieIdEditado, setEspecieId] = useState(publicacion.especieId);
    const [variedadIdEditado, setVariedadId] = useState(publicacion.variedadId ?? 0);
    const [categoriaIdEditado, setCategoriaId] = useState(publicacion.categoriaId ?? 0);
    const [calibreIdEditado, setCalibreId] = useState(publicacion.calibreId ?? 0);
    const [envaseIdEditado, setEnvaseId] = useState(publicacion.envaseId ?? 0);
    const [kilosIdEditado, setKilosId] = useState(publicacion.kilosId ?? 0);
    const [paisIdEditado, setPaisId] = useState(publicacion.paisId ?? 0);
    const [disponibleEditado, setDisponible] = useState(publicacion.disponible);
    const precio = editando ? precioEditado : (precioParaEdicion(publicacion.precio));
    const cantidadUnidades = editando ? cantidadUnidadesEditado : (publicacion.cantidadUnidades == null ? "" : String(publicacion.cantidadUnidades));
    const comentario = editando ? comentarioEditado : (publicacion.comentario ?? "");
    const foto = editando ? fotoEditado : (publicacion.foto);
    const especieId = editando ? especieIdEditado : (publicacion.especieId);
    const variedadId = editando ? variedadIdEditado : (publicacion.variedadId ?? 0);
    const categoriaId = editando ? categoriaIdEditado : (publicacion.categoriaId ?? 0);
    const calibreId = editando ? calibreIdEditado : (publicacion.calibreId ?? 0);
    const envaseId = editando ? envaseIdEditado : (publicacion.envaseId ?? 0);
    const kilosId = editando ? kilosIdEditado : (publicacion.kilosId ?? 0);
    const paisId = editando ? paisIdEditado : (publicacion.paisId ?? 0);
    const disponible = editando ? disponibleEditado : (publicacion.disponible);
    const inputFotoRef = useRef<HTMLInputElement>(null);
    const inputGaleriaRef = useRef<HTMLInputElement>(null);
    const urlVistaPreviaRef = useRef<string | null>(null);
    const idBase = `editar-publicacion-${publicacion.publicacionOperadorId}`;
    const ocupado = guardando || eliminando || actualizando;
    const bloqueado = ocupado || !editando;
    const fotoVisible = editando || guardada?.origen === recibida ? vistaPrevia ?? foto : publicacion.foto;
    if (fotoAmpliada && !fotoVisible?.trim()) setFotoAmpliada(false);
    const especieSeleccionada = especies.find((opcion) => opcion.id === especieId);
    const nombreFoto = especieSeleccionada?.nombre ?? publicacion.especie;
    const variedadSeleccionada = variedades.find((opcion) => opcion.id === variedadId);
    const variedadesDisponibles = variedades.filter((opcion) => opcion.especieId === especieId);
    const envasesDisponibles = envases;
    const categoriasDisponibles = categorias;
    const paisesOrdenados = [...paises].sort((primero, segundo) => compararPaisesPorPrioridad(primero.nombre, segundo.nombre));
    const fechaFormateada = publicacion ? new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Montevideo" }).format(new Date(publicacion.fecha)) : "";
    const [fechaVigenciaEditada, setFechaVigencia] = useState(publicacion.fechaVigencia ?? "");
    useEffect(() => {
        return () => {
            if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);
        };
    }, []);
    useEffect(() => {
        if (!editando && guardada?.origen !== recibida && urlVistaPreviaRef.current) {
            URL.revokeObjectURL(urlVistaPreviaRef.current);
            urlVistaPreviaRef.current = null;
        }
    }, [editando, guardada, recibida]);

    function seleccionarFoto(evento: ChangeEvent<HTMLInputElement>) {
        if (bloqueado) return;
        const archivo = evento.target.files?.[0];
        if (!archivo) return;

        if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type) || archivo.size === 0 || archivo.size > 10 * 1024 * 1024) {
            notificar("Seleccioná una imagen JPEG, PNG o WebP de hasta 10 MB.", "error");
            evento.target.value = "";
            return;
        }

        if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);
        const url = URL.createObjectURL(archivo);
        urlVistaPreviaRef.current = url;
        setVistaPrevia(url);
        setFotoNueva(archivo);
        cerrarNotificacion();
        evento.target.value = "";
    }

    function borrarFoto() {
        if (bloqueado) return;
        if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);
        urlVistaPreviaRef.current = null;
        setVistaPrevia(null);
        setFotoNueva(null);
        setFoto(null);
    }

    function escribirPrecio(nuevoPrecio: string) {
        if (bloqueado) return;
        if (esEntradaPrecioPublicacion(nuevoPrecio)) setPrecio(nuevoPrecio);
    }

    function escribirCantidadUnidades(nuevaCantidad: string) {
        if (bloqueado) return;
        if (nuevaCantidad === "") {
            setCantidadUnidades("");
            return;
        }
        if (!/^\d+$/.test(nuevaCantidad)) return;
        const valorLimpio = String(Number(nuevaCantidad));
        if (Number(valorLimpio) > 2147483647) return;
        setCantidadUnidades(valorLimpio);
    }

    function cambiarPrecio(cantidad: number) {
        if (bloqueado) return;
        const precioActual = Number(precio || "0");
        if (!Number.isInteger(precioActual)) return;
        const nuevoPrecio = Math.min(MAXIMO_PRECIO_PUBLICACION, precioActual + cantidad);
        setPrecio(nuevoPrecio <= 0 ? "" : String(nuevoPrecio));
    }

    function cambiarEspecie(nuevaEspecieId: number) {
        if (bloqueado) return;
        setEspecieId(nuevaEspecieId);
        setVariedadId(0);
    }

    function cambiarVariedad(nuevaVariedadId: number) {
        if (bloqueado) return;
        setVariedadId(nuevaVariedadId);
    }

    function prepararEdicion() {
        setFotoAmpliada(false);
        if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);
        urlVistaPreviaRef.current = null;
        if (inputFotoRef.current) inputFotoRef.current.value = "";
        if (inputGaleriaRef.current) inputGaleriaRef.current.value = "";
        setBaseEdicion(vigente);
        setVistaPrevia(null);
        setFotoNueva(null);
        setFoto(vigente.foto);
        setPrecio(precioParaEdicion(vigente.precio));
        setCantidadUnidades(vigente.cantidadUnidades == null ? "" : String(vigente.cantidadUnidades));
        setComentario(vigente.comentario ?? "");
        setEspecieId(vigente.especieId);
        setVariedadId(vigente.variedadId ?? 0);
        setEnvaseId(vigente.envaseId ?? 0);
        setKilosId(vigente.kilosId ?? 0);
        setCategoriaId(vigente.categoriaId ?? 0);
        setCalibreId(vigente.calibreId ?? 0);
        setPaisId(vigente.paisId ?? 0);
        setDisponible(vigente.disponible);
        cerrarNotificacion();
        setFechaVigencia(vigente.fechaVigencia ?? "");
    }

    function cancelarEdicion() {
        if (modoInicial === "edicion") { alCerrar(); return; }
        prepararEdicion();
        setEditando(false);
    }

    function solicitarGuardado(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (bloqueado) return;
        if (!precioPublicacionValido(precio)) {
            notificar(PRECIO_PUBLICACION_INVALIDO, "error");
            return;
        }

        const cantidadNormalizada = typeof cantidadUnidades === "string" ? cantidadUnidades.trim() : String(cantidadUnidades ?? "").trim();
        if (cantidadNormalizada !== "" && !formatoCantidad.test(cantidadNormalizada)) {
            notificar("La cantidad de unidades debe ser un número entero de hasta 10 dígitos.", "error");
            return;
        }

        const variedadValida = variedadId === 0 || variedadesDisponibles.some((opcion) => opcion.id === variedadId);
        const envaseValido = envaseId === 0 || envasesDisponibles.some((opcion) => opcion.id === envaseId);
        const kilosValidos = kilosId === 0 || kilos.some((opcion) => opcion.id === kilosId);
        const categoriaValida = categoriaId === 0 || categoriasDisponibles.some((opcion) => opcion.id === categoriaId);
        const calibreValido = calibreId === 0 || calibres.some((opcion) => opcion.id === calibreId);
        const paisValido = paisId === 0 || paises.some((opcion) => opcion.id === paisId);
        if (!especieSeleccionada || !variedadValida || !envaseValido || !kilosValidos || !categoriaValida || !calibreValido || !paisValido) {
            notificar("Elegí una especie, variedad, empaquetado, kilos, categoría, calibre y país válidos.", "error");
            return;
        }

        void guardar();
    }

    async function guardar() {
        if (bloqueado || !alGuardar) return;
        const { cambios, sinCambios } = prepararCambiosPublicacionOperador({
            publicacion, precio, cantidadUnidades, comentario, foto, fotoNueva, especieId, variedadId, categoriaId, calibreId, envaseId, kilosId, paisId, disponible, fechaVigenciaEditada,
        });

        if(sinCambios) {
            if(modoInicial === "consulta") {
                setFotoNueva(null);
                setEditando(false);
            } else {
                alCerrar();
            }
            return;
        }

        setGuardando(true);
        try {
            await alGuardar(publicacion.publicacionOperadorId, cambios, fotoNueva);
            setGuardada({ origen: recibida, datos: {
                ...publicacion, ...cambios, version: cambios.version + 1, foto,
                estadoFoto: fotoNueva || (foto === null && publicacion.foto !== null) ? null : publicacion.estadoFoto,
                estadoVigencia: cambios.fechaVigencia === publicacion.fechaVigencia ? publicacion.estadoVigencia : undefined,
                especie: especieSeleccionada?.nombre ?? publicacion.especie,
                variedad: variedadSeleccionada?.nombre ?? "",
                envase: envases.find((opcion) => opcion.id === envaseId)?.nombre ?? "",
                kilos: kilos.find((opcion) => opcion.id === kilosId)?.nombre ?? "",
                categoria: categorias.find((opcion) => opcion.id === categoriaId)?.nombre ?? "",
                calibre: calibres.find((opcion) => opcion.id === calibreId)?.nombre ?? "",
            } });
            if (modoInicial === "consulta") {
                setFotoNueva(null);
                setEditando(false);
            } else {
                alCerrar();
            }
        } catch (error) {
            notificar(error instanceof Error ? error.message : "No se pudieron guardar los cambios. Intentá de nuevo.", "error");
        } finally {
            setGuardando(false);
        }
    }

    return {
        publicacion, editando, setEditando, fotoAmpliada, setFotoAmpliada,
        precio, cantidadUnidades, comentario, fotoVisible, nombreFoto,
        variedadSeleccionada, especieId, variedadId, categoriaId, calibreId,
        envaseId, kilosId, paisId, disponible, inputFotoRef,
        inputGaleriaRef, idBase, ocupado, bloqueado, variedadesDisponibles,
        envasesDisponibles, categoriasDisponibles, paisesOrdenados, fechaFormateada, fechaVigenciaEditada,
        setFechaVigencia, seleccionarFoto, borrarFoto, escribirPrecio, escribirCantidadUnidades,
        cambiarPrecio, cambiarEspecie, cambiarVariedad, prepararEdicion, cancelarEdicion,
        solicitarGuardado, setCategoriaId, setCalibreId, setEnvaseId, setKilosId,
        setPaisId, setDisponible, setComentario,
    };
}
