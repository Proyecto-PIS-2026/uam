import styles from "./ControlesListadoOperadores.module.css";
import SearchIcon from "@mui/icons-material/Search";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import BotonOrdenar from "@/compartido/componentes/BotonOrdenar";

const propiedadesMenuSelect = { select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } } as const;

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
    let etiquetaNaveMasLarga = "Todas";
    for (const nave of navesDisponibles) {
        const etiqueta = nave === "Tinglado" ? nave : `Nave ${nave}`;
        if (etiqueta.length > etiquetaNaveMasLarga.length) etiquetaNaveMasLarga = etiqueta;
    }

    const contenido = (
        <div className={styles.contenedor}>
            <TextField fullWidth size="small" label="Buscar operadores" type="search" value={busqueda} onChange={(evento) => alCambiarBusqueda(evento.target.value)} className={`${styles.selectMui} ${styles.buscador}`}
                slotProps={{input: {startAdornment: <SearchIcon aria-hidden="true" sx={{ color: "var(--color-muted)" }} />}}}
            />

            <div className={styles.controles}>
                <div className={styles.selectorNave} data-opcion-mas-larga={etiquetaNaveMasLarga}>
                    <TextField select label="Nave" value={naveSeleccionada} onChange={(evento) => alCambiarNave(evento.target.value)} size="small" className={styles.selectMui} slotProps={propiedadesMenuSelect}>
                        <MenuItem value="Todas" className={styles.opcionSelect}>Todas</MenuItem>
                        {navesDisponibles.map((nave) => (
                            <MenuItem key={nave} value={nave} className={styles.opcionSelect}>
                                {nave === "Tinglado" ? nave : `Nave ${nave}`}
                            </MenuItem>
                        ))}
                    </TextField>
                </div>

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
