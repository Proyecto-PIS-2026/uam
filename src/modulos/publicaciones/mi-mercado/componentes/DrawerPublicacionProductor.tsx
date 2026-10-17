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
import type { PublicacionMiMercadoProductor } from "../consultas-mi-mercado-productor";
import styles from "./DrawerPublicacionProductor.module.css";

type Props = {
    publicacion: PublicacionMiMercadoProductor | null;
    alCerrar: () => void;
};

function enlaceMapa(url: string) {
    try {
        const enlace = new URL(url);
        return enlace.protocol === "https:" || enlace.protocol === "http:" ? enlace.href : null;
    } catch {
        return null;
    }
}

export default function DrawerPublicacionProductor({ publicacion, alCerrar }: Props) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const [fotoPreparada, setFotoPreparada] = useState<string | null>(null);
    const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
    const [necesitaScroll, setNecesitaScroll] = useState(false);
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

    useEffect(() => {
        const contenido = contenidoRef.current;
        if (!abierto || !contenido) return;
        contenido.scrollTop = 0;
        const actualizarScroll = () => setNecesitaScroll(contenido.scrollHeight > contenido.clientHeight + 1);
        actualizarScroll();
        const observer = new ResizeObserver(actualizarScroll);
        observer.observe(contenido);
        Array.from(contenido.children).forEach((hijo) => observer.observe(hijo));
        return () => observer.disconnect();
    }, [abierto, publicacion?.id, esWeb]);

    function cerrar() {
        setFotoAmpliada(null);
        setFotoPreparada(null);
        alCerrar();
    }

    return (
        <SwipeableDrawer anchor={esWeb ? "right" : "bottom"} open={abierto} onClose={cerrar} onOpen={() => {}} disableSwipeToOpen slotProps={{ paper: { className: styles.drawer, role: "dialog", "aria-modal": true, "aria-labelledby": tituloId } }} transitionDuration={{ enter: 400, exit: 400 }} ModalProps={{ keepMounted: true }}>
            {publicacion && (
                <>
                    <div className={styles.tarjeta}>
                        <div className={styles.encabezado}>
                            <h2 className={styles.titulo} id={tituloId}>Detalle de publicación</h2>
                            <button className={styles.cerrar} type="button" onClick={cerrar} aria-label="Cerrar consulta"><CloseIcon fontSize="small" /></button>
                        </div>
                        <div ref={contenidoRef} className={styles.contenidoScrollable}>
                            <div className={styles.cabecera}>
                                <div className={styles.bloqueSuperior}>
                                    <div className={styles.marcoImagen}>
                                        <div className={styles.contenedorImagen}>
                                            <ImagenPublicacion key={claveFoto} src={publicacion.foto} alt={`Foto de ${especie}`} fill sizes="(min-width: 768px) 400px, 160px" loading="eager" unoptimized className={styles.imagen} reemplazo={reemplazoFoto} onLoad={() => setFotoPreparada(claveFoto)} onError={() => setFotoPreparada(claveFoto)} />
                                            {tieneFoto && <button type="button" className={styles.ampliarFoto} aria-label={`Ampliar foto de ${especie}`} onClick={() => setFotoAmpliada(claveFoto)} />}
                                        </div>
                                    </div>
                                    <div className={styles.bloqueSuperiorDerecho}>
                                        <div className={styles.nombrePublicacion}>
                                            <TextoAjustable className={styles.especie} minimo={esWeb ? 16 : 10} maximo={esWeb ? 34 : 30}>{especie}</TextoAjustable>
                                            {variedad !== "-" && <TextoAjustable className={styles.variedad} minimo={esWeb ? 14 : 10} maximo={esWeb ? 26 : 23}>{variedad}</TextoAjustable>}
                                        </div>
                                        <div className={`${styles.precio} ${publicacion.precio === null ? styles.precioSinValor : ""}`}>
                                            {publicacion.precio === null ? "Consultar precio" : `$${publicacion.precio}`}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <dl className={styles.bloqueMedio}>
                                {campos.map(([nombre, valor]) => (
                                    <div key={nombre} className={styles.informacionDetallada}>
                                        <dt className={styles.nombreInformacion}>{nombre}</dt>
                                        <dd className={styles.valorInformacion}>{valor === "" ? "-" : valor}</dd>
                                    </div>
                                ))}
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
                        </div>
                        <div className={`${styles.pie} ${necesitaScroll ? styles.pieConScroll : ""}`}>
                            <div className={styles.bloqueBotones}>
                                <button className={styles.botonCerrar} type="button" onClick={cerrar}>Cerrar</button>
                                <button className={styles.botonEditar} type="button" disabled title="Próximamente">Editar</button>
                            </div>
                        </div>
                    </div>
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
