import styles from "./ControlesListadoOperadores.module.css";
import SearchIcon from "@mui/icons-material/Search";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";

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
                <TextField select label="Nave" value={naveSeleccionada} onChange={(evento) => alCambiarNave(evento.target.value)} size="small" className={styles.selectMui}>
                    <MenuItem value="" className={styles.opcionSelect}>Todas</MenuItem>
                    {navesDisponibles.map((nave) => (
                        <MenuItem key={nave} value={nave} className={styles.opcionSelect}>
                            Nave {nave}
                        </MenuItem>
                    ))}
                </TextField>

                <TextField select label="Ordenar por" value={orden} onChange={(evento) => alCambiarOrden(evento.target.value)} size="small" className={styles.selectMui}>
                    <MenuItem value="a-z" className={styles.opcionSelect}>A-Z</MenuItem>
                    <MenuItem value="z-a" className={styles.opcionSelect}>Z-A</MenuItem>
                </TextField>
            </div>
        </div>
    );

    return contenido;
}