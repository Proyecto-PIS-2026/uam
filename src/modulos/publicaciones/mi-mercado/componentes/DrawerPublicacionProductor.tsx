"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import Dialog from "@mui/material/Dialog";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import TextoAjustable from "../../componentes/drawer-publicacion/TextoAjustable";
import estilosAcciones from "../../operadores/componentes/DrawerEditarPublicacion.module.css";
import type { PublicacionMiMercadoProductor } from "../consultas-mi-mercado-productor";
import type { OpcionesEdicionPublicacion } from "../../operadores/consultas-edicion-publicacion";
import styles from "./DrawerPublicacionProductor.module.css";

type Props = {
    publicacion: PublicacionMiMercadoProductor | null;
    alCerrar: () => void;
    alGuardar?: (publicacion: PublicacionMiMercadoProductor) => void;
};

type Borrador = {
    id: number;
    precio: string;
    presentacionId: number;
    categoriaId: number;
    calibreId: number;
    foto: string | null;
    archivo: File | null;
    vistaPrevia: string | null;
    ubicaciones: { clave: number; nombreUbicacion: string; urlMaps: string }[];
};

function enlaceMapa(url: string) {
    try {
        const enlace = new URL(url);
        return enlace.protocol === "https:" || enlace.protocol === "http:" ? enlace.href : null;
    } catch {
        return null;
    }
}

export default function DrawerPublicacionProductor({ publicacion: recibida, alCerrar, alGuardar }: Props) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const [guardada, setGuardada] = useState<{ original: PublicacionMiMercadoProductor; nueva: PublicacionMiMercadoProductor } | null>(null);
    const publicacion = guardada?.original === recibida ? guardada.nueva : recibida;
    const [borrador, setBorrador] = useState<Borrador | null>(null);
    const [opciones, setOpciones] = useState<OpcionesEdicionPublicacion | null>(null);
    const [cargando, setCargando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [errores, setErrores] = useState<string[]>([]);
    const [aviso, setAviso] = useState("");
    const solicitudRef = useRef(0);
    const claveUbicacionRef = useRef(0);
    const archivoRef = useRef<HTMLInputElement>(null);
    const camaraRef = useRef<HTMLInputElement>(null);
    const edicion = borrador?.id === publicacion?.id ? borrador : null;
    const [fotoPreparada, setFotoPreparada] = useState<string | null>(null);
    const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
    const contenidoRef = useRef<HTMLDivElement>(null);
    const claveFoto = publicacion ? `${publicacion.id}-${publicacion.foto ?? ""}` : "";
    const tieneFoto = Boolean(publicacion?.foto?.trim());
    const abierto = publicacion !== null && (!tieneFoto || fotoPreparada === claveFoto);
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
    const fotoVisible = edicion ? edicion.vistaPrevia ?? edicion.foto : publicacion?.foto;
    const presentaciones = opciones?.presentaciones.filter((opcion) => opcion.variedadId === publicacion?.presentacion.variedad.id) ?? [];
    const categorias = opciones?.categorias.filter((opcion) => opcion.especieId === null || opcion.especieId === publicacion?.presentacion.variedad.especie.id) ?? [];

    useEffect(() => {
        const contenido = contenidoRef.current;
        if (!abierto || !contenido) return;
        contenido.scrollTop = 0;
    }, [abierto, publicacion?.id, esWeb]);

    useEffect(() => () => { solicitudRef.current++; }, [recibida?.id]);
    useEffect(() => () => {
        if (borrador?.vistaPrevia) URL.revokeObjectURL(borrador.vistaPrevia);
    }, [borrador?.vistaPrevia]);

    function cerrar() {
        if (guardando) return;
        solicitudRef.current++;
        setBorrador(null);
        setCargando(false);
        setErrores([]);
        setAviso("");
        setGuardada(null);
        setFotoAmpliada(null);
        setFotoPreparada(null);
        alCerrar();
    }

    async function comenzarEdicion() {
        if (!publicacion || cargando || guardando) return;
        const solicitud = ++solicitudRef.current;
        setCargando(true);
        setErrores([]);
        setAviso("");
        try {
            const respuesta = await fetch(`/api/publicaciones/productor/${publicacion.publicacionProductorId}`, { cache: "no-store" });
            const resultado = await respuesta.json();
            if (solicitud !== solicitudRef.current) return;
            if (!respuesta.ok) {
                setErrores(resultado.errores ?? ["No se pudo cargar la edición."]);
                return;
            }
            setOpciones(resultado.opciones);
            setBorrador({
                id: publicacion.id,
                precio: publicacion.precio === null ? "" : String(Number(publicacion.precio)),
                presentacionId: publicacion.presentacion.id,
                categoriaId: publicacion.categoria.id,
                calibreId: publicacion.calibre.id,
                foto: publicacion.foto,
                archivo: null,
                vistaPrevia: null,
                ubicaciones: publicacion.ubicaciones.map(({ nombreUbicacion, urlMaps }) => ({ clave: ++claveUbicacionRef.current, nombreUbicacion, urlMaps })),
            });
        } catch {
            if (solicitud === solicitudRef.current) setErrores(["No se pudo cargar la edición. Intentá nuevamente."]);
        } finally {
            if (solicitud === solicitudRef.current) setCargando(false);
        }
    }

    function actualizar(cambios: Partial<Borrador>) {
        setBorrador((actual) => actual ? { ...actual, ...cambios } : actual);
        setErrores([]);
    }

    function seleccionarFoto(evento: ChangeEvent<HTMLInputElement>) {
        const archivo = evento.target.files?.[0];
        evento.target.value = "";
        if (!archivo) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) || archivo.size === 0 || archivo.size > 10 * 1024 * 1024) {
            setErrores(["Seleccioná una imagen JPEG, PNG o WebP de hasta 10 MB."]);
            return;
        }
        actualizar({ archivo, vistaPrevia: URL.createObjectURL(archivo) });
    }

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (!edicion || !publicacion || !recibida || guardando) return;
        if (edicion.precio !== "" && !/^\d{1,10}$/.test(edicion.precio)) {
            setErrores(["El precio debe ser un número entero de hasta 10 dígitos, sin decimales."]);
            return;
        }
        const solicitud = ++solicitudRef.current;
        const formulario = new FormData();
        formulario.set("cambios", JSON.stringify({
            precio: edicion.precio === "" ? null : String(Number(edicion.precio)),
            presentacionId: edicion.presentacionId,
            categoriaId: edicion.categoriaId,
            calibreId: edicion.calibreId,
            foto: edicion.foto,
            ubicaciones: edicion.ubicaciones.map(({ nombreUbicacion, urlMaps }) => ({ nombreUbicacion: nombreUbicacion.trim(), urlMaps: urlMaps.trim() })),
        }));
        if (edicion.archivo) formulario.set("foto", edicion.archivo);
        setGuardando(true);
        setErrores([]);
        try {
            const respuesta = await fetch(`/api/publicaciones/productor/${publicacion.publicacionProductorId}`, { method: "PATCH", body: formulario });
            const resultado = await respuesta.json();
            if (solicitud !== solicitudRef.current) return;
            if (!respuesta.ok) {
                setErrores(resultado.errores ?? ["No se pudieron guardar los cambios."]);
                return;
            }
            const nueva: PublicacionMiMercadoProductor = resultado.publicacion;
            setFotoPreparada(`${nueva.id}-${nueva.foto ?? ""}`);
            setGuardada({ original: recibida, nueva });
            setBorrador(null);
            setAviso("Cambios guardados.");
            alGuardar?.(nueva);
        } catch {
            if (solicitud === solicitudRef.current) setErrores(["No se pudieron guardar los cambios. Intentá nuevamente."]);
        } finally {
            if (solicitud === solicitudRef.current) setGuardando(false);
        }
    }

    return (
        <SwipeableDrawer anchor={esWeb ? "right" : "bottom"} open={abierto} onClose={cerrar} onOpen={() => {}} disableSwipeToOpen slotProps={{ paper: { className: styles.drawer, role: "dialog", "aria-modal": true, "aria-labelledby": tituloId } }} transitionDuration={{ enter: 400, exit: 400 }} ModalProps={{ keepMounted: true }}>
            {publicacion && (
                <>
                    <form className={styles.tarjeta} onSubmit={guardar} aria-busy={guardando}>
                        <div className={styles.encabezado}>
                            <h2 className={styles.titulo} id={tituloId}>{edicion ? "Editar publicación" : "Detalle de publicación"}</h2>
                            <button className={styles.cerrar} type="button" onClick={cerrar} disabled={guardando} aria-label="Cerrar consulta"><CloseIcon fontSize="small" /></button>
                        </div>
                        <div ref={contenidoRef} className={styles.contenidoScrollable}>
                            <div className={styles.cabecera}>
                                <div className={styles.bloqueSuperior}>
                                    <div className={styles.marcoImagen}>
                                        <div className={styles.contenedorImagen}>
                                            <ImagenPublicacion key={fotoVisible} src={fotoVisible} alt={`Foto de ${especie}`} fill sizes="(min-width: 768px) 400px, 160px" loading="eager" unoptimized className={styles.imagen} reemplazo={reemplazoFoto} onLoad={() => setFotoPreparada(claveFoto)} onError={() => setFotoPreparada(claveFoto)} />
                                            {tieneFoto && !edicion && <button type="button" className={styles.ampliarFoto} aria-label={`Ampliar foto de ${especie}`} onClick={() => setFotoAmpliada(claveFoto)} />}
                                        </div>
                                    </div>
                                    <div className={styles.bloqueSuperiorDerecho}>
                                        <div className={styles.nombrePublicacion}>
                                            <TextoAjustable className={styles.especie} minimo={esWeb ? 16 : 10} maximo={esWeb ? 34 : 30}>{especie}</TextoAjustable>
                                            {variedad !== "-" && <TextoAjustable className={styles.variedad} minimo={esWeb ? 14 : 10} maximo={esWeb ? 26 : 23}>{variedad}</TextoAjustable>}
                                        </div>
                                        {edicion ? <label className={styles.campoPrecio}>
                                            <span>Precio en pesos</span>
                                            <input className={styles.entrada} type="text" inputMode="numeric" maxLength={10} value={edicion.precio} placeholder="Sin precio" disabled={guardando} onChange={(evento) => { if (/^\d{0,10}$/.test(evento.target.value)) actualizar({ precio: evento.target.value }); }} />
                                        </label> : <div className={`${styles.precio} ${publicacion.precio === null ? styles.precioSinValor : ""}`}>
                                            {publicacion.precio === null ? "Consultar precio" : `$${Number(publicacion.precio).toFixed(0)}`}
                                        </div>}
                                    </div>
                                </div>
                            </div>
                            {edicion && <section className={styles.edicionFoto} aria-label="Fotografía del producto">
                                <p className={styles.ayuda}>Mostrá la calidad del producto con una foto. JPEG, PNG o WebP, hasta 10 MB.</p>
                                <div className={styles.accionesFoto}>
                                    <button type="button" className={styles.botonSecundario} disabled={guardando} onClick={() => archivoRef.current?.click()}>Seleccionar archivo</button>
                                    {!esWeb && <button type="button" className={styles.botonSecundario} disabled={guardando} onClick={() => camaraRef.current?.click()}>Tomar foto</button>}
                                    {fotoVisible && <button type="button" className={styles.botonSecundario} disabled={guardando} onClick={() => actualizar({ foto: null, archivo: null, vistaPrevia: null })}>Quitar foto</button>}
                                </div>
                                <input ref={archivoRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Seleccionar fotografía" hidden disabled={guardando} onChange={seleccionarFoto} />
                                {!esWeb && <input ref={camaraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="Tomar fotografía" hidden disabled={guardando} onChange={seleccionarFoto} />}
                            </section>}
                            <dl className={styles.bloqueMedio}>
                                {campos.map(([nombre, valor]) => {
                                    const campo = nombre === "Presentación" ? "presentacionId" : nombre === "Categoría" ? "categoriaId" : nombre === "Calibre" ? "calibreId" : null;
                                    const disponibles = campo === "presentacionId" ? presentaciones : campo === "categoriaId" ? categorias : opciones?.calibres ?? [];
                                    const entradaId = `edicion-productor-${publicacion.id}-${campo}`;
                                    return <div key={nombre} className={`${styles.informacionDetallada} ${edicion && campo ? styles.filaEditable : ""}`}>
                                        <dt className={styles.nombreInformacion}>{edicion && campo ? <label htmlFor={entradaId}>{nombre}</label> : nombre}</dt>
                                        <dd className={styles.valorInformacion}>{edicion && campo ? <select id={entradaId} className={styles.entrada} value={edicion[campo]} disabled={guardando} required onChange={(evento) => actualizar({ [campo]: Number(evento.target.value) })}>
                                            {!disponibles.some((opcion) => opcion.id === edicion[campo]) && <option value={edicion[campo]} disabled>{valor} (no disponible)</option>}
                                            {disponibles.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
                                        </select> : valor === "" ? "-" : valor}</dd>
                                    </div>;
                                })}
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
                                {edicion ? <div className={styles.listaUbicaciones}>
                                    {edicion.ubicaciones.map((ubicacion, indice) => <fieldset className={styles.ubicacionEditable} key={ubicacion.clave} disabled={guardando}>
                                        <legend>Punto de retiro {indice + 1}</legend>
                                        <label className={styles.campoUbicacion}>Nombre del punto de retiro {indice + 1}
                                            <input className={styles.entrada} value={ubicacion.nombreUbicacion} maxLength={200} required onChange={(evento) => actualizar({ ubicaciones: edicion.ubicaciones.map((actual) => actual.clave === ubicacion.clave ? { ...actual, nombreUbicacion: evento.target.value } : actual) })} />
                                        </label>
                                        <label className={styles.campoUbicacion}>Enlace de Google Maps {indice + 1}
                                            <input className={styles.entrada} type="url" value={ubicacion.urlMaps} maxLength={2048} placeholder="https://maps.app.goo.gl/..." required onChange={(evento) => actualizar({ ubicaciones: edicion.ubicaciones.map((actual) => actual.clave === ubicacion.clave ? { ...actual, urlMaps: evento.target.value } : actual) })} />
                                        </label>
                                        <button type="button" className={styles.botonSecundario} aria-label={`Eliminar punto de retiro ${indice + 1}`} onClick={() => actualizar({ ubicaciones: edicion.ubicaciones.filter((actual) => actual.clave !== ubicacion.clave) })}>Eliminar punto</button>
                                    </fieldset>)}
                                    <button type="button" className={styles.botonSecundario} disabled={guardando || edicion.ubicaciones.length >= 20} onClick={() => actualizar({ ubicaciones: [...edicion.ubicaciones, { clave: ++claveUbicacionRef.current, nombreUbicacion: "", urlMaps: "" }] })}>Agregar punto de retiro</button>
                                </div> : publicacion.ubicaciones.length === 0 ? <p className={styles.descripcionUbicacion}>No hay puntos de retiro informados.</p> : (
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
                        <div className={estilosAcciones.pie}>
                            {edicion ? <>
                                <button className={estilosAcciones.cancelar} type="button" disabled={guardando} onClick={() => { setBorrador(null); setErrores([]); }}>Cancelar</button>
                                <button className={estilosAcciones.guardar} type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Guardar cambios"}</button>
                            </> : <>
                                <button className={`${estilosAcciones.cancelar} ${estilosAcciones.eliminar}`} type="button" disabled title="Próximamente">Eliminar</button>
                                <button className={estilosAcciones.guardar} type="button" disabled={cargando} onClick={comenzarEdicion}>Editar</button>
                            </>}
                        </div>
                    </form>
                    <Dialog open={abierto && fotoAmpliada === claveFoto && tieneFoto} onClose={() => setFotoAmpliada(null)} maxWidth={false} fullWidth aria-label="Foto ampliada del producto" slotProps={{ paper: { className: styles.modalFoto }, backdrop: { sx: { backgroundColor: "rgba(0, 0, 0, 0.85)" } } }}>
                        <button type="button" aria-label="Cerrar foto ampliada" onClick={() => setFotoAmpliada(null)} className={`${styles.cerrar} ${styles.cerrarFoto}`}><CloseIcon fontSize="small" /></button>
                        <div className={styles.fotoAmpliada}>
                            <ImagenPublicacion key={claveFoto} src={publicacion.foto} alt={`Foto ampliada de ${especie}`} fill sizes="100vw" unoptimized className={styles.imagenAmpliada} reemplazo={reemplazoFoto} />
                        </div>
                    </Dialog>
                </>
            )}
        </SwipeableDrawer>
    );
}
