import EstadoVacio from "../../../../compartido/componentes/EstadoVacio";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { PublicacionMiMercadoProductor } from "../tipos";
import styles from "./DrawerPublicacionProductor.module.css";

function enlaceMapa(url: string) {
    try {
        const enlace = new URL(url);
        return enlace.protocol === "https:" || enlace.protocol === "http:" ? enlace.href : null;
    } catch {
        return null;
    }
}

export default function UbicacionesConsultaProductor({ publicacion }: { publicacion: PublicacionMiMercadoProductor }) {
    return <section className={styles.ubicaciones} aria-labelledby={`ubicaciones-${publicacion.id}`}>
        <h3 className={styles.tituloUbicaciones} id={`ubicaciones-${publicacion.id}`}>Puntos de retiro</h3>
        {publicacion.ubicaciones.length === 0 ? (
            <EstadoVacio
                titulo="No hay puntos de retiro informados."
                descripcion="Los puntos de retiro aparecerán aquí cuando se agreguen a la publicación."
                icono={<LocationOnOutlinedIcon />}
                compacto
                anunciar={false}
            />
        ) : (
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

