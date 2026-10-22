import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { UbicacionPublicacionProductorListado } from "@/modulos/consulta-mercado/acciones/PublicacionesProductor";
import styles from "./UbicacionesRetiro.module.css";

type UbicacionesRetiroProps = {
    ubicaciones: UbicacionPublicacionProductorListado[];
};

export default function UbicacionesRetiro({ ubicaciones}: UbicacionesRetiroProps) {
    const contenido = (
        <div className={styles.contenedor}>
            <div className={styles.titulo}>Puntos de retiro</div>
            {ubicaciones.length === 0 ? (
                <div className={styles.descripcion}>No hay puntos de retiro informados.</div>
            ) : (
                <div className={styles.lista}>
                    {ubicaciones.map((ubicacion, indice) => (
                        <div key={ubicacion.id}>
                            <a href={ubicacion.urlMaps} target="_blank" rel="noopener noreferrer" className={styles.ubicacion}>
                                <span className={styles.icono} aria-hidden="true">
                                    <LocationOnOutlinedIcon />
                                </span>
                                <div className={styles.informacion}>
                                    <span className={styles.nombre}>
                                        {ubicacion.nombreUbicacion.trim() || `Punto de entrega ${indice + 1}`}
                                    </span>
                                    <span className={styles.descripcion}>Ver ubicación en Google Maps</span>
                                </div>
                                <ChevronRightIcon className={styles.flecha} aria-hidden="true"/>
                            </a>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
    return contenido; 
}