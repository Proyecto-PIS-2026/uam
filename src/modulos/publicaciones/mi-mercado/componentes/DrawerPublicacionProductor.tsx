"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import DrawerDeslizable from "@/compartido/componentes/DrawerDeslizable";
import Dialog from "@mui/material/Dialog";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import { ConfirmModal } from "../../../../compartido/componentes/ConfirmModal";
import NotificacionToast, { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import { compararPaisesPorPrioridad } from "@/compartido/prioridad-paises";
import type { PublicacionMiMercadoProductor } from "../consultas-mi-mercado-productor";
import type { CambiosPublicacionProductor } from "../../productores/modificar-publicacion";
import type { OpcionesEdicionPublicacion } from "../../operadores/tipos";
import { ordenarOpcionesPorNombre } from "../../operadores/ordenar-opciones";
import { compararEspeciesPorPrioridad } from "@/compartido/prioridad-especies";
import UbicacionesEdicionProductor, { type UbicacionEdicionProductor } from "../../productores/UbicacionesEdicionProductor";
import { AYUDA_PRECIO_PUBLICACION, MAXIMO_DIGITOS_PRECIO, PRECIO_PUBLICACION_INVALIDO, esEntradaPrecioPublicacion, normalizarPrecioPublicacion, precioPublicacionValido } from "../../precio-publicacion";
import estilosAcciones from "../../operadores/componentes/DrawerEditarPublicacion.module.css";
import styles from "./DrawerPublicacionProductor.module.css";

type Props = {
    publicacion: PublicacionMiMercadoProductor | null;
    alCerrar: () => void;
    alEliminada?: (mensaje: string) => void;
    alGuardar?: (publicacion: PublicacionMiMercadoProductor) => void;
};

type Borrador = {
    precio: string;
    cantidadUnidades: string;
    especieId: number;
    variedadId: number;
    presentacionId: number;
    categoriaId: number;
    calibreId: number;
    paisId: number;
    disponible: boolean;
    foto: string | null;
    archivo: File | null;
    vistaPrevia: string | null;
    ubicaciones: UbicacionEdicionProductor[];
};

type Estado = {
    id: number | null;
    sesion: object;
    guardada: { original: PublicacionMiMercadoProductor; nueva: PublicacionMiMercadoProductor } | null;
    edicion: { base: PublicacionMiMercadoProductor; opciones: OpcionesEdicionPublicacion; borrador: Borrador } | null;
    cargaPara: PublicacionMiMercadoProductor | null;
    confirmacionPara: PublicacionMiMercadoProductor | null;
    guardando: boolean;
    eliminando: boolean;
    fotoPreparada: boolean;
    fotoAmpliada: boolean;
    errores: string[];
};

function estadoInicial(publicacion: Props["publicacion"]): Estado {
    return {
        id: publicacion?.id ?? null, sesion: {}, guardada: null, edicion: null,
        cargaPara: null, confirmacionPara: null, guardando: false, eliminando: false,
        fotoPreparada: !publicacion?.foto?.trim(), fotoAmpliada: false, errores: [],
    };
}

function crearBorrador(publicacion: PublicacionMiMercadoProductor): Borrador {
    return {
        precio: publicacion.precio === null ? "" : String(Number(publicacion.precio)),
        cantidadUnidades: publicacion.cantidadUnidades == null ? "" : String(publicacion.cantidadUnidades),
        especieId: publicacion.especie.id,
        variedadId: publicacion.variedad?.id ?? 0,
        presentacionId: publicacion.presentacion?.id ?? 0,
        categoriaId: publicacion.categoria?.id ?? 0,
        calibreId: publicacion.calibre?.id ?? 0,
        paisId: publicacion.paisId ?? 0,
        disponible: publicacion.publicacionDisponible,
        foto: publicacion.foto, archivo: null, vistaPrevia: null,
        ubicaciones: publicacion.ubicaciones.map(({ id, nombreUbicacion, urlMaps }) => ({ clave: id, nombreUbicacion, urlMaps })),
    };
}

function Campo({ nombre, valor, opciones, nombreActual, cambiar, deshabilitado = false, enConsulta = false, priorizarUruguay = false, priorizarEspecies = false }: {
    nombre: string;
    valor: number;
    opciones: { id: number; nombre: string }[];
    nombreActual: string;
    cambiar?: (id: number) => void;
    deshabilitado?: boolean;
    enConsulta?: boolean;
    priorizarUruguay?: boolean;
    priorizarEspecies?: boolean;
}) {
    const ordenadas = priorizarEspecies
        ? [...opciones].sort((a, b) => compararEspeciesPorPrioridad(a.nombre, b.nombre))
        : priorizarUruguay
            ? [...opciones].sort((a, b) => compararPaisesPorPrioridad(a.nombre, b.nombre))
            : ordenarOpcionesPorNombre(opciones);
    return <TextField select label={nombre} value={valor} onChange={(evento) => cambiar?.(Number(evento.target.value))}
        size="small" fullWidth required={nombre === "Especie"} disabled={deshabilitado} className={estilosAcciones.selectMui}
        slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } }}>
        <MenuItem value={0} disabled={nombre === "Especie"} className={estilosAcciones.opcionSelect}>{nombre === "Especie" ? "Seleccioná especie" : enConsulta ? "-" : "Sin especificar"}</MenuItem>
        {valor !== 0 && !opciones.some((opcion) => opcion.id === valor) && <MenuItem value={valor} disabled className={estilosAcciones.opcionSelect}>{nombreActual?.trim() || "-"}</MenuItem>}
        {ordenadas.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={estilosAcciones.opcionSelect}>{opcion.nombre}</MenuItem>)}
    </TextField>;
}

function enlaceMapa(url: string) {
    try {
        const enlace = new URL(url);
        return enlace.protocol === "https:" || enlace.protocol === "http:" ? enlace.href : null;
    } catch {
        return null;
    }
}

function UbicacionesConsulta({ publicacion }: { publicacion: PublicacionMiMercadoProductor }) {
    return <section className={styles.ubicaciones} aria-labelledby={`ubicaciones-${publicacion.id}`}>
        <h3 className={styles.tituloUbicaciones} id={`ubicaciones-${publicacion.id}`}>Puntos de retiro</h3>
        {publicacion.ubicaciones.length === 0 ? <p className={styles.descripcionUbicacion}>No hay puntos de retiro informados.</p> : (
            <ul className={styles.listaUbicaciones}>
                {publicacion.ubicaciones.map((ubicacion, indice) => {
                    const enlace = enlaceMapa(ubicacion.urlMaps);
                    const nombreId = `ubicacion-${ubicacion.id}-nombre`;
                    const accionId = `ubicacion-${ubicacion.id}-accion`;
                    const contenido = <>
                        <span className={styles.iconoUbicacion}><LocationOnOutlinedIcon aria-hidden="true" /></span>
                        <span className={styles.informacionUbicacion}>
                            <span className={styles.nombreUbicacion} id={nombreId}>{ubicacion.nombreUbicacion.trim() || `Punto de entrega ${indice + 1}`}</span>
                            <span className={styles.descripcionUbicacion} id={accionId}>
                                {enlace ? <>Ver ubicación en Google Maps<span className="sr-only"> (se abre en una pestaña nueva)</span></> : "Mapa no disponible"}
                            </span>
                        </span>
                        {enlace && <ChevronRightIcon className={styles.flechaUbicacion} aria-hidden="true" />}
                    </>;
                    return <li key={ubicacion.id}>{enlace ? (
                        <a href={enlace} target="_blank" rel="noopener noreferrer" className={styles.ubicacion} aria-labelledby={nombreId} aria-describedby={accionId}>{contenido}</a>
                    ) : <div className={styles.ubicacion}>{contenido}</div>}</li>;
                })}
            </ul>
        )}
    </section>;
}

export default function DrawerPublicacionProductor({ publicacion: recibida, alCerrar, alGuardar, alEliminada }: Props) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const [estado, setEstado] = useState(() => estadoInicial(recibida));
    const { notificacion, notificar, cerrarNotificacion } = useNotificacionToast();
    const sesionRef = useRef<object | null>(null);
    const operacionRef = useRef<object | null>(null);
    const solicitudOpcionesRef = useRef<object | null>(null);
    const recibidaRef = useRef(recibida);
    const alGuardarRef = useRef(alGuardar);
    const panelRef = useRef<HTMLDivElement>(null);
    const contenidoRef = useRef<HTMLDivElement>(null);
    const fotoRef = useRef<HTMLInputElement>(null);
    const galeriaRef = useRef<HTMLInputElement>(null);

    if (estado.id !== (recibida?.id ?? null)) {
        setEstado(estadoInicial(recibida));
        cerrarNotificacion();
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
    const abierto = recibida !== null && (estado.fotoPreparada || !tieneFoto);
    const tituloId = publicacion ? `publicacion-productor-${publicacion.id}-titulo` : undefined;
    const variedad = publicacion?.variedad;
    const especie = publicacion?.especie;
    const especieId = borrador?.especieId ?? especie?.id;
    const variedadId = borrador?.variedadId ?? variedad?.id;
    const variedades = edicion?.opciones.variedades.filter((opcion) => opcion.especieId === especieId) ?? [];
    const presentaciones = edicion?.opciones.presentaciones.filter((opcion) => opcion.variedadId === variedadId) ?? [];
    const categorias = edicion?.opciones.categorias.filter((opcion) => opcion.especieId === null || opcion.especieId === especieId) ?? [];
    const nombrePresentacion = borrador?.presentacionId === 0 ? null : presentaciones.find((opcion) => opcion.id === borrador?.presentacionId)?.nombre ?? publicacion?.presentacion?.nombrePresentacion;
    const disponible = borrador?.disponible ?? publicacion?.publicacionDisponible;
    const fechaFormateada = publicacion ? new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Montevideo" }).format(new Date(publicacion.fecha)) : "";
    const reemplazoFoto = <div className={estilosAcciones.sinFoto}><PhotoCameraOutlinedIcon aria-hidden="true" /><span>Sin foto</span></div>;
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

    useEffect(() => {
        if (abierto && contenidoRef.current) contenidoRef.current.scrollTop = 0;
    }, [abierto, estado.id, esWeb]);

    useLayoutEffect(() => {
        if (abierto && document.activeElement === document.body) {
            panelRef.current?.focus({ preventScroll: true });
        }
    }, [abierto, editando, estado.guardando]);

    function cerrar() {
        solicitudOpcionesRef.current = null;
        sesionRef.current = null;
        setEstado(estadoInicial(recibida));
        cerrarNotificacion();
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

    function cambiar(cambios: Partial<Borrador>) {
        if (operacionRef.current === estado.sesion) return;
        setEstado((actual) => actual.edicion ? {
            ...actual, errores: [], edicion: { ...actual.edicion, borrador: { ...actual.edicion.borrador, ...cambios } },
        } : actual);
    }

    function cambiarEspecie(nuevaEspecieId: number) {
        if (!edicion || !borrador) return;
        const opciones = edicion.opciones;
        const categoriaActual = opciones.categorias.find((opcion) => opcion.id === borrador.categoriaId);
        const categoriaCompatible = categoriaActual?.especieId === null || categoriaActual?.especieId === nuevaEspecieId;
        cambiar({
            especieId: nuevaEspecieId,
            variedadId: 0,
            presentacionId: 0,
            categoriaId: categoriaCompatible ? borrador.categoriaId : 0,
        });
    }

    function cambiarVariedad(nuevaVariedadId: number) {
        if (!edicion) return;
        cambiar({ variedadId: nuevaVariedadId, presentacionId: 0 });
    }

    function escribirCantidadUnidades(valor: string) {
        if (valor === "") cambiar({ cantidadUnidades: "" });
        else if (/^\d+$/.test(valor) && Number(valor) <= 2147483647) cambiar({ cantidadUnidades: String(Number(valor)) });
    }

    function cancelarEdicion() {
        if (operacionRef.current === estado.sesion) return;
        setEstado((actual) => ({ ...actual, edicion: null, errores: [] }));
        cerrarNotificacion();
    }

    function seleccionarFoto(evento: ChangeEvent<HTMLInputElement>) {
        const archivo = evento.target.files?.[0];
        evento.target.value = "";
        if (!archivo || !editando || operacionRef.current === estado.sesion) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type) || archivo.size === 0 || archivo.size > 10 * 1024 * 1024) {
            setEstado((actual) => ({ ...actual, errores: ["Seleccioná una imagen JPEG, PNG o WebP de hasta 10 MB."] }));
            return;
        }
        cambiar({ archivo, vistaPrevia: URL.createObjectURL(archivo) });
    }

    async function comenzarEdicion() {
        if (!vigente || editando || cargando || operacionRef.current === estado.sesion || confirmando) return;
        const solicitud = {};
        solicitudOpcionesRef.current = solicitud;
        setEstado((actual) => ({ ...actual, cargaPara: vigente }));
        cerrarNotificacion();
        try {
            const respuesta = await fetch(`/api/publicaciones/productor/${vigente.publicacionProductorId}`, { cache: "no-store" });
            const resultado = await respuesta.json();
            if (solicitud !== solicitudOpcionesRef.current) return;
            if (!respuesta.ok) {
                notificar(resultado.errores?.join(" ") || "No se pudo cargar la edición.", "error");
                return;
            }
            setEstado((actual) => ({ ...actual, errores: [], fotoAmpliada: false, edicion: { base: vigente, opciones: resultado.opciones, borrador: crearBorrador(vigente) } }));
        } catch {
            if (solicitud === solicitudOpcionesRef.current) notificar("No se pudo cargar la edición. Intentá nuevamente.", "error");
        } finally {
            if (solicitud === solicitudOpcionesRef.current) setEstado((actual) => ({ ...actual, cargaPara: null }));
        }
    }

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (!edicion || !borrador || operacionRef.current === estado.sesion) return;
        cerrarNotificacion();
        if (!precioPublicacionValido(borrador.precio)) {
            setEstado((actual) => ({ ...actual, errores: [PRECIO_PUBLICACION_INVALIDO] }));
            return;
        }
        if (borrador.cantidadUnidades !== "" && (!/^(0|[1-9]\d{0,9})$/.test(borrador.cantidadUnidades) || Number(borrador.cantidadUnidades) > 2147483647)) {
            setEstado((actual) => ({ ...actual, errores: ["La cantidad de unidades debe ser un número entero entre 0 y 2147483647."] }));
            return;
        }
        const opciones = edicion.opciones;
        if (!opciones.especies.some((opcion) => opcion.id === borrador.especieId)
            || (borrador.variedadId !== 0 && !variedades.some((opcion) => opcion.id === borrador.variedadId))
            || (borrador.presentacionId !== 0 && !presentaciones.some((opcion) => opcion.id === borrador.presentacionId))
            || (borrador.categoriaId !== 0 && !categorias.some((opcion) => opcion.id === borrador.categoriaId))
            || (borrador.calibreId !== 0 && !opciones.calibres.some((opcion) => opcion.id === borrador.calibreId))
            || (borrador.paisId !== 0 && !opciones.paises.some((opcion) => opcion.id === borrador.paisId))) {
            setEstado((actual) => ({ ...actual, errores: ["Elegí una especie, variedad, presentación, categoría, calibre y país válidos."] }));
            return;
        }
        const formulario = new FormData();
        const cambios: CambiosPublicacionProductor = {
            precio: normalizarPrecioPublicacion(borrador.precio),
            cantidadUnidades: borrador.cantidadUnidades === "" ? null : Number(borrador.cantidadUnidades),
            especieId: borrador.especieId, variedadId: borrador.variedadId || null,
            presentacionId: borrador.presentacionId || null, categoriaId: borrador.categoriaId || null, calibreId: borrador.calibreId || null,
            paisId: borrador.paisId || null, disponible: borrador.disponible,
            foto: borrador.foto,
            ubicaciones: borrador.ubicaciones.map(({ nombreUbicacion, urlMaps }) => ({ nombreUbicacion: nombreUbicacion.trim(), urlMaps: urlMaps.trim() })),
        };
        formulario.set("cambios", JSON.stringify(cambios));
        if (borrador.archivo) formulario.set("foto", borrador.archivo);
        const sesion = estado.sesion;
        operacionRef.current = sesion;
        setEstado((actual) => ({ ...actual, guardando: true, errores: [] }));
        try {
            const respuesta = await fetch(`/api/publicaciones/productor/${edicion.base.publicacionProductorId}`, { method: "PATCH", body: formulario });
            const resultado = await respuesta.json();
            if (sesionRef.current !== sesion) return;
            if (!respuesta.ok) {
                const mensajes = resultado.errores?.length ? resultado.errores : ["No se pudieron guardar los cambios."];
                if (respuesta.status === 400 || respuesta.status === 422) setEstado((actual) => ({ ...actual, errores: mensajes }));
                else notificar(mensajes.join(" "), "error");
                return;
            }
            const original = recibidaRef.current;
            if (!original) return;
            setEstado((actual) => ({ ...actual, guardada: { original, nueva: resultado.publicacion }, edicion: null, errores: [] }));
            notificar("Cambios guardados.", "success");
            alGuardarRef.current?.(resultado.publicacion);
        } catch {
            if (sesionRef.current === sesion) notificar("No se pudieron guardar los cambios. Intentá nuevamente.", "error");
        } finally {
            if (operacionRef.current === sesion) operacionRef.current = null;
            if (sesionRef.current === sesion) setEstado((actual) => ({ ...actual, guardando: false }));
        }
    }

    async function eliminar() {
        if (!vigente || operacionRef.current === estado.sesion || cargando || editando) return;
        const sesion = estado.sesion;
        operacionRef.current = sesion;
        setEstado((actual) => ({ ...actual, eliminando: true }));
        cerrarNotificacion();
        try {
            const respuesta = await fetch(`/api/publicaciones/productor/${vigente.publicacionProductorId}`, { method: "DELETE" });
            const resultado = await respuesta.json().catch(() => ({}));
            if (!respuesta.ok && respuesta.status !== 404) throw new Error(resultado.errores?.[0] ?? "No se pudo eliminar la publicación.");
            const mensaje = respuesta.ok ? (resultado.mensaje ?? "Publicación eliminada correctamente.") : "La publicación ya había sido eliminada.";
            if (sesionRef.current === sesion) cerrar();
            alEliminada?.(mensaje);
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

    return <>
        <NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} />
        <DrawerDeslizable anchor={esWeb ? "right" : "bottom"} open={abierto} onClose={solicitarCierre} arrastreDeshabilitado={ocupado || confirmando}
            slotProps={{ paper: { ref: panelRef, tabIndex: -1, className: estilosAcciones.panel, role: "dialog", "aria-modal": true, "aria-labelledby": tituloId } }} transitionDuration={{ enter: 400, exit: 400 }} ModalProps={{ keepMounted: true }}>
            {publicacion && especie && <>
                <header className={`${estilosAcciones.encabezado} ${estilosAcciones.encabezadoConAsa}`}>
                    <div className={estilosAcciones.bloqueSuperior}>
                        <h2 className={estilosAcciones.titulo} id={tituloId}>{editando ? "Editar publicación" : "Consulta de publicación"}</h2>
                        <div className={estilosAcciones.informacionDetallada}>
                            <span className={estilosAcciones.nombreInformacion}>Actualización</span>
                            <time dateTime={publicacion.fecha} className={estilosAcciones.valorInformacion}>{fechaFormateada}</time>
                        </div>
                    </div>
                    <button className={estilosAcciones.cerrar} type="button" onClick={solicitarCierre} disabled={ocupado} aria-label={editando ? "Cerrar edición" : "Cerrar consulta"}><CloseIcon fontSize="small" /></button>
                </header>
                <form className={estilosAcciones.formulario} onSubmit={guardar} aria-busy={ocupado}>
                    <div ref={contenidoRef} className={estilosAcciones.cuerpo}>
                        <div className={estilosAcciones.campo}>
                            <label className={estilosAcciones.etiqueta} htmlFor={`publicacion-productor-${publicacion.id}-precio`}>Precio en pesos</label>
                            <input className={estilosAcciones.entrada} id={`publicacion-productor-${publicacion.id}-precio`} inputMode="numeric" maxLength={MAXIMO_DIGITOS_PRECIO}
                                value={borrador?.precio ?? (publicacion.precio === null ? "" : String(Number(publicacion.precio)))} placeholder={editando ? "Ingresar precio aquí" : "Consultar precio"} readOnly={!editando} disabled={ocupado}
                                onChange={(evento) => esEntradaPrecioPublicacion(evento.target.value) && cambiar({ precio: evento.target.value })} />
                            {editando && <small className={estilosAcciones.ayuda}>{AYUDA_PRECIO_PUBLICACION}</small>}
                        </div>
                        <div className={estilosAcciones.campo}>
                            <label className={estilosAcciones.etiqueta} htmlFor={`publicacion-productor-${publicacion.id}-unidades`}>Unidades{nombrePresentacion ? ` (${nombrePresentacion})` : ""}</label>
                            <input className={estilosAcciones.entrada} id={`publicacion-productor-${publicacion.id}-unidades`} inputMode="numeric" maxLength={10}
                                value={borrador?.cantidadUnidades ?? publicacion.cantidadUnidades ?? ""} placeholder={editando ? "Ingresar cantidad aquí" : "-"} readOnly={!editando} disabled={ocupado}
                                onChange={(evento) => escribirCantidadUnidades(evento.target.value)} />
                            {editando && <small className={estilosAcciones.ayuda}>Dejalo vacío si no querés ingresar una cantidad.</small>}
                        </div>
                        <div className={estilosAcciones.seccionFoto}>
                            <div className={estilosAcciones.marcoFoto}>
                                <ImagenPublicacion key={publicacion.id} src={fotoVisible} alt={editando ? "Vista previa de la fotografía" : `Foto de ${especie.nombreEspecie}`} fill sizes="(min-width: 768px) 480px, 100vw" loading="eager" unoptimized className={estilosAcciones.imagenFoto} reemplazo={reemplazoFoto}
                                    onLoad={() => setEstado((actual) => ({ ...actual, fotoPreparada: true }))} onError={() => setEstado((actual) => ({ ...actual, fotoPreparada: true }))} />
                                {!editando && tieneFoto && <button type="button" className={styles.ampliarFoto} aria-label={`Ampliar foto de ${especie.nombreEspecie}`} onClick={() => setEstado((actual) => ({ ...actual, fotoAmpliada: true }))} />}
                                {editando && <>
                                    {tieneFoto && <button type="button" className={`${estilosAcciones.botonFoto} ${estilosAcciones.borrarFoto}`} onClick={() => cambiar({ foto: null, archivo: null, vistaPrevia: null })} disabled={ocupado}><DeleteOutlinedIcon fontSize="small" /> Borrar foto</button>}
                                    <button type="button" className={estilosAcciones.botonFoto} onClick={() => fotoRef.current?.click()} disabled={ocupado}>{esWeb ? "Editar foto" : "Cámara"}</button>
                                    {!esWeb && <button type="button" className={`${estilosAcciones.botonFoto} ${estilosAcciones.botonGaleria}`} onClick={() => galeriaRef.current?.click()} disabled={ocupado}>Galería</button>}
                                    <input ref={fotoRef} className={estilosAcciones.inputFoto} type="file" accept="image/png,image/jpeg,image/webp" capture={esWeb ? undefined : "environment"} onChange={seleccionarFoto} disabled={ocupado} aria-label="Fotografía" />
                                    {!esWeb && <input ref={galeriaRef} className={estilosAcciones.inputFoto} type="file" accept="image/png,image/jpeg,image/webp" onChange={seleccionarFoto} disabled={ocupado} aria-label="Fotografía desde galería" />}
                                </>}
                            </div>
                        </div>
                        <div className={estilosAcciones.accionesPublicacion} data-editando={editando}>
                            <label className={estilosAcciones.disponibilidad} htmlFor={editando ? `publicacion-productor-${publicacion.id}-disponibilidad` : undefined} data-disponible={disponible} data-guardando={ocupado} data-editando={editando}>
                                {editando ? <>
                                    <span className={estilosAcciones.textoDisponibilidad}><span className={estilosAcciones.etiqueta}>Disponibilidad</span><span className={estilosAcciones.estadoDisponibilidad}>{disponible ? "Disponible" : "No disponible"}</span></span>
                                    <Switch className={estilosAcciones.interruptorDisponibilidad} checked={Boolean(disponible)} onChange={(_, valor) => cambiar({ disponible: valor })} disabled={ocupado} slotProps={{ input: { id: `publicacion-productor-${publicacion.id}-disponibilidad`, role: "switch", "aria-label": "Publicación disponible" } }} />
                                </> : <span className={`${estilosAcciones.estadoDisponibilidad} ${estilosAcciones.estadoDisponibilidadConsulta}`}>{disponible ? "Disponible" : "No disponible"}</span>}
                            </label>
                        </div>
                        <div className={estilosAcciones.datosProducto} data-editando={editando}>
                            <Campo nombre="Especie" valor={borrador?.especieId ?? especie.id} opciones={edicion?.opciones.especies ?? []} nombreActual={especie.nombreEspecie} cambiar={cambiarEspecie} deshabilitado={!editando || ocupado} enConsulta={!editando} priorizarEspecies />
                            <Campo nombre="Variedad" valor={borrador?.variedadId ?? variedad?.id ?? 0} opciones={variedades} nombreActual={variedad?.nombreVariedad ?? ""} cambiar={cambiarVariedad} deshabilitado={!editando || ocupado} enConsulta={!editando} />
                            <Campo nombre="Presentación" valor={borrador?.presentacionId ?? publicacion.presentacion?.id ?? 0} opciones={presentaciones} nombreActual={publicacion.presentacion?.nombrePresentacion ?? ""} cambiar={(id) => cambiar({ presentacionId: id })} deshabilitado={!editando || ocupado} enConsulta={!editando} />
                            <Campo nombre="País de origen" valor={borrador?.paisId ?? publicacion.paisId ?? 0} opciones={edicion?.opciones.paises ?? []} nombreActual={publicacion.pais || ""} cambiar={(id) => cambiar({ paisId: id })} deshabilitado={!editando || ocupado} enConsulta={!editando} priorizarUruguay />
                            <Campo nombre="Categoría" valor={borrador?.categoriaId ?? publicacion.categoria?.id ?? 0} opciones={categorias} nombreActual={publicacion.categoria?.nombreCategoria ?? ""} cambiar={(id) => cambiar({ categoriaId: id })} deshabilitado={!editando || ocupado} enConsulta={!editando} />
                            <Campo nombre="Calibre" valor={borrador?.calibreId ?? publicacion.calibre?.id ?? 0} opciones={edicion?.opciones.calibres ?? []} nombreActual={publicacion.calibre?.nombreCalibre ?? ""} cambiar={(id) => cambiar({ calibreId: id })} deshabilitado={!editando || ocupado} enConsulta={!editando} />
                        </div>
                        {borrador ? <UbicacionesEdicionProductor ubicaciones={borrador.ubicaciones} deshabilitado={ocupado} alCambiar={(ubicaciones) => cambiar({ ubicaciones })} /> : <UbicacionesConsulta publicacion={publicacion} />}
                        {estado.errores.length > 0 && <div role="alert" className={estilosAcciones.error}>{estado.errores.map((error, indice) => <p key={indice}>{error}</p>)}</div>}
                        {cargando && <p className={estilosAcciones.ayuda} role="status">Cargando edición...</p>}
                    </div>
                    <div className={estilosAcciones.pie}>
                        {editando ? <>
                            <button className={estilosAcciones.cancelar} type="button" onClick={cancelarEdicion} disabled={ocupado}>Cancelar</button>
                            <button className={estilosAcciones.guardar} type="submit" disabled={ocupado}>{estado.guardando ? "Guardando..." : "Confirmar"}</button>
                        </> : <>
                            <button className={`${estilosAcciones.cancelar} ${estilosAcciones.eliminar}`} type="button" disabled={ocupado || cargando} onClick={() => { cerrarNotificacion(); setEstado((actual) => ({ ...actual, confirmacionPara: vigente })); }}>Eliminar</button>
                            <button className={estilosAcciones.guardar} type="button" disabled={cargando || ocupado || confirmando} onClick={comenzarEdicion}>Editar</button>
                        </>}
                    </div>
                </form>
                <ConfirmModal abierto={confirmando} titulo="Eliminar publicación" descripcion={`¿Querés eliminar la publicación de ${especie.nombreEspecie}? Esta acción no se puede deshacer.`} textoConfirmar="Sí, eliminar" procesando={estado.eliminando} alCancelar={() => { if (operacionRef.current !== estado.sesion) setEstado((actual) => ({ ...actual, confirmacionPara: null })); }} alConfirmar={() => void eliminar()} />
                <Dialog open={abierto && !editando && estado.fotoAmpliada && tieneFoto} onClose={() => setEstado((actual) => ({ ...actual, fotoAmpliada: false }))} maxWidth={false} fullWidth aria-label="Foto ampliada del producto" slotProps={{ paper: { className: styles.modalFoto, "aria-label": "Foto ampliada del producto" }, backdrop: { sx: { backgroundColor: "rgba(0, 0, 0, 0.85)" } } }}>
                    <button type="button" aria-label="Cerrar foto ampliada" onClick={() => setEstado((actual) => ({ ...actual, fotoAmpliada: false }))} className={`${estilosAcciones.cerrar} ${styles.cerrarFoto}`}><CloseIcon fontSize="small" /></button>
                    <div className={styles.fotoAmpliada}>
                        <ImagenPublicacion key={publicacion.id} src={publicacion.foto} alt={`Foto ampliada de ${especie.nombreEspecie}`} fill sizes="100vw" unoptimized className={styles.imagenAmpliada} reemplazo={reemplazoFoto} />
                    </div>
                </Dialog>
            </>}
        </DrawerDeslizable>
    </>;
}
