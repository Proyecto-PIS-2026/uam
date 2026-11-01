import styles from "./ControlesListadoProductores.module.css";
import SearchIcon from "@mui/icons-material/Search";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import BotonOrdenar from "@/compartido/componentes/BotonOrdenar";

type ControlesListadoProductoresProps  = {
    busqueda: string;
    alCambiarBusqueda: (nuevoValor: string) => void;
    orden: string;
    alCambiarOrden: (nuevoOrden: string) => void;
    departamento: string;
    departamentosDisponibles: string[];
    alCambiarDepartamento: (departamento: string) => void;
};

export default function ControlesListadoProductores({ busqueda, alCambiarBusqueda, orden, alCambiarOrden, departamento, departamentosDisponibles, alCambiarDepartamento }: ControlesListadoProductoresProps ) {
    const contenido = (
        <div className={styles.contenedor}>
            <TextField fullWidth size="small" label="Buscar productores" type="search" value={busqueda} onChange={(evento) => alCambiarBusqueda(evento.target.value)} className={`${styles.selectMui} ${styles.buscador}`}
                slotProps={{input: {startAdornment: <SearchIcon aria-hidden="true" sx={{ color: "var(--color-muted)" }} />}}}
            />
            <div className={styles.controles}>
                <TextField select label="Departamento" value={departamento} onChange={(evento) => alCambiarDepartamento(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.selectorDepartamento}`}
                    slotProps={{ select: { displayEmpty: true, MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)" } } } } }, inputLabel: { shrink: true } }}>
                    <MenuItem value="" className={styles.opcionSelect}>Todos</MenuItem>
                    {departamentosDisponibles.map((nombre) => <MenuItem key={nombre} value={nombre} className={styles.opcionSelect}>{nombre}</MenuItem>)}
                </TextField>
                <BotonOrdenar
                    valor={orden}
                    opciones={[{ valor: "a-z", etiqueta: "A-Z" }, { valor: "z-a", etiqueta: "Z-A" }]}
                    alCambiar={alCambiarOrden}
                />
            </div>
        </div>
    );
    return contenido;
}
