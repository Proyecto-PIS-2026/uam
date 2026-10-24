"use client";

import { useEffect, useRef, useState } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import Dialog from "@mui/material/Dialog";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import TextoAjustable from "../../componentes/drawer-publicacion/TextoAjustable";
import { ConfirmModal } from "../../../../compartido/componentes/ConfirmModal";
import estilosAcciones from "../../operadores/componentes/DrawerEditarPublicacion.module.css";
import type { PublicacionMiMercadoProductor } from "../consultas-mi-mercado-productor";
import type { OpcionesEdicionPublicacion } from "../../operadores/consultas-edicion-publicacion";
import DrawerEditarPublicacionProductor from "./DrawerEditarPublicacionProductor";
import styles from "./DrawerPublicacionProductor.module.css";

type Props = {
    publicacion: PublicacionMiMercadoProductor | null;
    alCerrar: () => void;
    alEliminada?: (mensaje: string) => void;
    alGuardar?: (publicacion: PublicacionMiMercadoProductor) => void;
};

function enlaceMapa(url: string) {
    try {
        const enlace = new URL(url);
        return enlace.protocol === "https:" || enlace.protocol === "http:" ? enlace.href : null;
    } catch {
        return null;
    }
}

export default function DrawerPublicacionProductor({ publicacion: recibida, alCerrar, alGuardar, alEliminada }: Props) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const [confirmacionPara, setConfirmacionPara] = useState<PublicacionMiMercadoProductor | null>(null);
    const [eliminando, setEliminando] = useState(false);
    const [errorBaja, setErrorBaja] = useState("");
    const eliminandoRef = useRef(false);
    const [guardada, setGuardada] = useState<{ original: PublicacionMiMercadoProductor; nueva: PublicacionMiMercadoProductor } | null>(null);
    const publicacion = guardada?.original === recibida ? guardada.nueva : recibida;
    const confirmando = publicacion !== null && confirmacionPara === publicacion;
    const [formulario, setFormulario] = useState<{ original: PublicacionMiMercadoProductor; opciones: OpcionesEdicionPublicacion } | null>(null);
    const edicion = formulario?.original === publicacion ? formulario : null;
    const [cargaPara, setCargaPara] = useState<PublicacionMiMercadoProductor | null>(null);
    const cargando = publicacion !== null && cargaPara === publicacion;
    const [errores, setErrores] = useState<string[]>([]);
    const [aviso, setAviso] = useState("");
    const solicitudRef = useRef(0);
    const [fotoPreparada, setFotoPreparada] = useState<string | null>(null);
    const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
    const contenidoRef = useRef<HTMLDivElement>(null);
    const claveFoto = publicacion ? `${publicacion.id}-${publicacion.foto ?? ""}` : "";
    const tieneFoto = Boolean(publicacion?.foto?.trim());
    const abierto = publicacion !== null && !edicion && (!tieneFoto || fotoPreparada === claveFoto);
    const tituloId = publicacion ? `publicacion-productor-${publicacion.id}-titulo` : undefined;
    const especie = publicacion?.presentacion.variedad.especie.nombreEspecie ?? "";
    const variedad = publicacion?.presentacion.variedad.nombreVariedad ?? "";
    const fechaFormateada = publicacion ? new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Montevideo" }).format(new Date(publicacion.fecha)) : "";
    const campos = publicacion ? [
        ["Presentación", publicacion.presentacion.nombrePresentacion],
        ["Calibre", publicacion.calibre.nombreCalibre],
        ["Categoría", publicacion.categoria.nombreCategoria],
        [`Unidades (${publicacion.presentacion.nombrePresentacion})`, publicacion.cantidadUnidades ?? "-"],
        ["País", publicacion.pais],
    ] : [];
    const reemplazoFoto = <div className={styles.sinFoto}><ImageOutlinedIcon className={styles.iconoFoto} aria-hidden="true" /><span>Foto</span></div>;

    useEffect(() => {
        const contenido = contenidoRef.current;
        if (!abierto || !contenido) return;
        contenido.scrollTop = 0;
    }, [abierto, publicacion?.id, esWeb]);

    useEffect(() => () => { solicitudRef.current++; }, [recibida]);

    function cerrar() {
        solicitudRef.current++;
        setFormulario(null);
        setCargaPara(null);
        setErrores([]);
        setAviso("");
        setGuardada(null);
        setFotoAmpliada(null);
        setFotoPreparada(null);
        setConfirmacionPara(null);
        setErrorBaja("");
        alCerrar();
    }

    function solicitarCierre() {
        if (eliminandoRef.current) return;
        if (confirmando) {
            setConfirmacionPara(null);
            return;
        }
        cerrar();
    }

    async function eliminar() {
        if (!publicacion || eliminandoRef.current || cargando || edicion) return;
        const solicitud = ++solicitudRef.current;
        eliminandoRef.current = true;
        setEliminando(true);
        setErrorBaja("");
        try {
            const respuesta = await fetch(`/api/publicaciones/productor/${publicacion.publicacionProductorId}`, { method: "DELETE" });
            const resultado = await respuesta.json().catch(() => ({}));
            if (!respuesta.ok && respuesta.status !== 404) {
                throw new Error(resultado.errores?.[0] ?? "No se pudo eliminar la publicación.");
            }
            const mensaje = respuesta.ok
                ? (resultado.mensaje ?? "Publicación eliminada correctamente.")
                : "La publicación ya había sido eliminada.";
            if (solicitud === solicitudRef.current) cerrar();
            alEliminada?.(mensaje);
        } catch (error) {
            if (solicitud === solicitudRef.current) {
                setConfirmacionPara(null);
                setErrorBaja(error instanceof Error ? error.message : "No se pudo conectar con el servidor.");
            }
        } finally {
            eliminandoRef.current = false;
            setEliminando(false);
        }
    }

    async function comenzarEdicion() {
        if (!publicacion || cargando || eliminandoRef.current || confirmando) return;
        const solicitud = ++solicitudRef.current;
        setCargaPara(publicacion);
        setErrores([]);
        setAviso("");
        setErrorBaja("");
        try {
            const respuesta = await fetch(`/api/publicaciones/productor/${publicacion.publicacionProductorId}`, { cache: "no-store" });
            const resultado = await respuesta.json();
            if (solicitud !== solicitudRef.current) return;
            if (!respuesta.ok) {
                setErrores(resultado.errores ?? ["No se pudo cargar la edición."]);
                return;
            }
            setFormulario({ original: publicacion, opciones: resultado.opciones });
        } catch {
            if (solicitud === solicitudRef.current) setErrores(["No se pudo cargar la edición. Intentá nuevamente."]);
        } finally {
            if (solicitud === solicitudRef.current) setCargaPara(null);
        }
    }

    function guardar(nueva: PublicacionMiMercadoProductor) {
        if (!recibida) return;
        setFotoPreparada(`${nueva.id}-${nueva.foto ?? ""}`);
        setGuardada({ original: recibida, nueva });
        setFormulario(null);
        setAviso("Cambios guardados.");
        alGuardar?.(nueva);
    }

    return (<>
        <SwipeableDrawer anchor={esWeb ? "right" : "bottom"} open={abierto} onClose={solicitarCierre} onOpen={() => {}} disableSwipeToOpen slotProps={{ paper: { className: styles.drawer, role: "dialog", "aria-modal": true, "aria-labelledby": tituloId } }} transitionDuration={{ enter: 400, exit: 400 }} ModalProps={{ keepMounted: true }}>
            {publicacion && !edicion && (
                <>
                    <div className={styles.tarjeta}>
                        <div className={styles.encabezado}>
                            <h2 className={styles.titulo} id={tituloId}>Detalle de publicación</h2>
                            <button className={styles.cerrar} type="button" onClick={solicitarCierre} disabled={eliminando} aria-label="Cerrar consulta"><CloseIcon fontSize="small" /></button>
                        </div>
                        <div ref={contenidoRef} className={styles.contenidoScrollable}>
                            <div className={styles.cabecera}>
                                <div className={styles.bloqueSuperior}>
                                    <div className={styles.marcoImagen}>
                                        <div className={styles.contenedorImagen}>
                                            <ImagenPublicacion key={publicacion.foto} src={publicacion.foto} alt={`Foto de ${especie}`} fill sizes="(min-width: 768px) 400px, 160px" loading="eager" unoptimized className={styles.imagen} reemplazo={reemplazoFoto} onLoad={() => setFotoPreparada(claveFoto)} onError={() => setFotoPreparada(claveFoto)} />
                                            {tieneFoto && <button type="button" className={styles.ampliarFoto} aria-label={`Ampliar foto de ${especie}`} onClick={() => setFotoAmpliada(claveFoto)} />}
                                        </div>
                                    </div>
                                    <div className={styles.bloqueSuperiorDerecho}>
                                        <div className={styles.nombrePublicacion}>
                                            <TextoAjustable className={styles.especie} minimo={esWeb ? 16 : 10} maximo={esWeb ? 34 : 30}>{especie}</TextoAjustable>
                                            {variedad !== "-" && <TextoAjustable className={styles.variedad} minimo={esWeb ? 14 : 10} maximo={esWeb ? 26 : 23}>{variedad}</TextoAjustable>}
                                        </div>
                                        <div className={`${styles.precio} ${publicacion.precio === null ? styles.precioSinValor : ""}`}>
                                            {publicacion.precio === null ? "Consultar precio" : `$${Number(publicacion.precio).toFixed(0)}`}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <dl className={styles.bloqueMedio}>
                                {campos.map(([nombre, valor]) => <div key={nombre} className={styles.informacionDetallada}>
                                    <dt className={styles.nombreInformacion}>{nombre}</dt>
                                    <dd className={styles.valorInformacion}>{valor === "" ? "-" : valor}</dd>
                                </div>)}
                                <div className={styles.informacionDetallada}>
                                    <dt className={styles.nombreInformacion}>Actualización</dt>
                                    <dd className={styles.valorInformacion}><time dateTime={publicacion.fecha}>{fechaFormateada}</time></dd>
                                </div>
                                <div className={styles.informacionDetallada}>
                                    <dt className={styles.nombreInformacion}>Disponibilidad</dt>
                                    <dd className={styles.valorInformacion}>{publicacion.publicacionDisponible ? "Disponible" : "No disponible"}</dd>
                                </div>
                            </dl>
                            <section className={styles.ubicaciones} aria-labelledby={`ubicaciones-${publicacion.id}`}>
                                <h3 className={styles.tituloUbicaciones} id={`ubicaciones-${publicacion.id}`}>Puntos de retiro</h3>
                                {publicacion.ubicaciones.length === 0 ? <p className={styles.descripcionUbicacion}>No hay puntos de retiro informados.</p> : (
                                    <ul className={styles.listaUbicaciones}>
                                        {publicacion.ubicaciones.map((ubicacion, indice) => {
                                            const enlace = enlaceMapa(ubicacion.urlMaps);
                                            const nombreId = `ubicacion-${ubicacion.id}-nombre`;
                                            const accionId = `ubicacion-${ubicacion.id}-accion`;
                                            const contenido = (
                                                <>
                                                    <span className={styles.iconoUbicacion}><LocationOnOutlinedIcon aria-hidden="true" /></span>
                                                    <span className={styles.informacionUbicacion}>
                                                        <span className={styles.nombreUbicacion} id={nombreId}>{ubicacion.nombreUbicacion.trim() || `Punto de entrega ${indice + 1}`}</span>
                                                        <span className={styles.descripcionUbicacion} id={accionId}>
                                                            {enlace ? <>Ver ubicación en Google Maps<span className="sr-only"> (se abre en una pestaña nueva)</span></> : "Mapa no disponible"}
                                                        </span>
                                                    </span>
                                                    {enlace && <ChevronRightIcon className={styles.flechaUbicacion} aria-hidden="true" />}
                                                </>
                                            );
                                            return <li key={ubicacion.id}>{enlace ? (
                                                <a href={enlace} target="_blank" rel="noopener noreferrer" className={styles.ubicacion} aria-labelledby={nombreId} aria-describedby={accionId}>{contenido}</a>
                                            ) : <div className={styles.ubicacion}>{contenido}</div>}</li>;
                                        })}
                                    </ul>
                                )}
                            </section>
                            {cargando && <p className={styles.ayuda} role="status">Cargando edición...</p>}
                            {aviso && <p className={styles.aviso} role="status">{aviso}</p>}
                            {errores.length > 0 && <div className={styles.error} role="alert">{errores.map((error, indice) => <p key={indice}>{error}</p>)}</div>}
                        </div>
                        {errorBaja && <p className="px-4 pb-2 text-sm text-red-800" role="alert">{errorBaja}</p>}
                        <div className={estilosAcciones.pie}>
                            <button className={`${estilosAcciones.cancelar} ${estilosAcciones.eliminar}`} type="button" disabled={eliminando || cargando} onClick={() => { setErrorBaja(""); setErrores([]); setAviso(""); setConfirmacionPara(publicacion); }}>Eliminar</button>
                            <button className={estilosAcciones.guardar} type="button" disabled={cargando || eliminando || confirmando} onClick={comenzarEdicion}>Editar</button>
                        </div>
                    </div>
                    <ConfirmModal abierto={confirmando} titulo="Eliminar publicación" descripcion={`¿Querés eliminar la publicación de ${especie}? Esta acción no se puede deshacer.`} textoConfirmar="Sí, eliminar" procesando={eliminando} alCancelar={() => { if (!eliminandoRef.current) setConfirmacionPara(null); }} alConfirmar={() => void eliminar()} />
                    <Dialog open={abierto && fotoAmpliada === claveFoto && tieneFoto} onClose={() => setFotoAmpliada(null)} maxWidth={false} fullWidth aria-label="Foto ampliada del producto" slotProps={{ paper: { className: styles.modalFoto }, backdrop: { sx: { backgroundColor: "rgba(0, 0, 0, 0.85)" } } }}>
                        <button type="button" aria-label="Cerrar foto ampliada" onClick={() => setFotoAmpliada(null)} className={`${styles.cerrar} ${styles.cerrarFoto}`}><CloseIcon fontSize="small" /></button>
                        <div className={styles.fotoAmpliada}>
                            <ImagenPublicacion key={claveFoto} src={publicacion.foto} alt={`Foto ampliada de ${especie}`} fill sizes="100vw" unoptimized className={styles.imagenAmpliada} reemplazo={reemplazoFoto} />
                        </div>
                    </Dialog>
                </>
            )}
        </SwipeableDrawer>
        {publicacion && edicion && <DrawerEditarPublicacionProductor key={publicacion.id} publicacion={publicacion} opciones={edicion.opciones} alCerrar={() => setFormulario(null)} alGuardar={guardar} />}
    </>);
}
