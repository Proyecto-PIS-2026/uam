import styles from "./ControlesListadoProductores.module.css";
import SearchIcon from "@mui/icons-material/Search";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";

type ControlesListadoProductoresProps  = {
    busqueda: string;
    alCambiarBusqueda: (nuevoValor: string) => void;
    orden: string;
    alCambiarOrden: (nuevoOrden: string) => void;
};

export default function ControlesListadoProductores({ busqueda, alCambiarBusqueda, orden, alCambiarOrden }: ControlesListadoProductoresProps ) {
    const contenido = (
        <div className={styles.contenedor}>
            <TextField fullWidth size="small" label="Buscar productores" type="search" value={busqueda} onChange={(evento) => alCambiarBusqueda(evento.target.value)} className={`${styles.selectMui} ${styles.buscador}`}
                slotProps={{input: {startAdornment: <SearchIcon aria-hidden="true" sx={{ color: "var(--color-muted)" }} />}}}
            />
            <div className={styles.controles}>
                <TextField select label="Ordenar por" value={orden} onChange={(evento) => alCambiarOrden(evento.target.value)} size="small" className={styles.selectMui}>
                    <MenuItem value="a-z" className={styles.opcionSelect}>A-Z</MenuItem>
                    <MenuItem value="z-a" className={styles.opcionSelect}>Z-A</MenuItem>
                </TextField>
            </div>
        </div>
    );
    return contenido;
}
