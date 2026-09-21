import styles from "./ControlesListadoOperadores.module.css";
import SearchIcon from "@mui/icons-material/Search";

type ControlesListadoOperadoresProps = {
    busqueda: string;
    alCambiarBusqueda: (nuevoValor: string) => void;
    orden: string;
    alCambiarOrden: (nuevoOrden: string) => void;
    naveSeleccionada: string;
    alCambiarNave: (nuevaNave: string) => void;
    navesDisponibles: string[];
};

export default function ControlesListadoOperadores({busqueda, alCambiarBusqueda, orden, alCambiarOrden, naveSeleccionada, alCambiarNave, navesDisponibles}: ControlesListadoOperadoresProps) {

    const contenido = (
        <div className={styles.contenedor}>
            <div className={styles.buscador}>
                <SearchIcon aria-hidden="true" className={styles.iconoBusqueda}/>
                <input className={styles.inputBusqueda} type="search" value={busqueda} onChange={(evento) => alCambiarBusqueda(evento.target.value)} placeholder="Buscar operadores"/>
            </div>

            <div className={styles.controles}>
                <div className={styles.control}>
                    <label htmlFor="filtro-nave" className={styles.label}>Nave</label>
                    <select id="filtro-nave" value={naveSeleccionada} onChange={(evento) => alCambiarNave(evento.target.value)} className={styles.select}>
                        <option value="">Todas</option>
                        {navesDisponibles.map((nave) => (
                            <option key={nave} value={nave}>Nave {nave}</option>
                        ))}
                    </select>
                </div>

                <div className={styles.control}>
                    <label htmlFor="orden-operadores" className={styles.label}>Ordenar por</label>
                    <select id="orden-operadores" value={orden} onChange={(evento) => alCambiarOrden(evento.target.value)} className={styles.select}>
                        <option value="a-z">A-Z</option>
                        <option value="z-a">Z-A</option>
                    </select>
                </div>
            </div>
        </div>
    );

    return contenido;
}