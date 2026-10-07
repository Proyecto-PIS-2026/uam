import styles from "./BuscadorUsuario.module.css";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import type { TipoUsuario } from "../../Compartidos/Tipos";

const propiedadesMenuSelect = { select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } } as const;

type BuscadorUsuarioProps = {
    busqueda: string;
    onBusquedaChange: (nuevoValor: string) => void;
    tipoUsuario: TipoUsuario | "TODOS";
    onTipoUsuarioChange: (nuevoTipo: TipoUsuario | "TODOS") => void;
};

const rolesDisponibles: { value: TipoUsuario | "TODOS"; label: string }[] = [
    { value: "TODOS", label: "Todos" },
    { value: "ADMINISTRADOR", label: "Administrador" },
    { value: "OPERADOR", label: "Operador" },
    { value: "PRODUCTOR", label: "Productor" },
];

export default function BuscadorUsuario({ busqueda, onBusquedaChange, tipoUsuario, onTipoUsuarioChange }: BuscadorUsuarioProps) {
    let etiquetaRolMasLarga = "Todos";
    for (const rol of rolesDisponibles) {
        if (rol.label.length > etiquetaRolMasLarga.length) etiquetaRolMasLarga = rol.label;
    }

    return (
        <div className={styles.contenedor}>
            <TextField fullWidth size="small" label="Buscar usuarios" type="search" value={busqueda} onChange={(evento) => 
                onBusquedaChange(evento.target.value)} className={`${styles.selectMui} ${styles.buscador}`} slotProps={{ input: { startAdornment: <SearchIcon aria-hidden="true" sx={{ color: "var(--color-muted)" }} /> } }}
            />

            <div className={styles.controles}>
                <div className={styles.selectorRol} data-opcion-mas-larga={etiquetaRolMasLarga}>
                    <TextField select label="Rol" value={tipoUsuario} onChange={(evento) => 
                        onTipoUsuarioChange(evento.target.value as TipoUsuario | "TODOS")} size="small" className={styles.selectMui} slotProps={propiedadesMenuSelect}>
                        {rolesDisponibles.map((rol) => (
                            <MenuItem key={rol.value} value={rol.value} className={styles.opcionSelect}> {rol.label} </MenuItem>
                        ))}
                    </TextField>
                </div>

                <Select value={tipoUsuario} onChange={(evento) => 
                    onTipoUsuarioChange(evento.target.value as TipoUsuario | "TODOS")} className={styles.selectorRolMovil} displayEmpty renderValue={() => 
                        <FilterListIcon aria-hidden="true"/>} aria-label="Filtrar por rol" MenuProps={{slotProps: {paper: {sx: {maxHeight: "min(20rem, 50dvh)", overflowY: "auto"}}}}}
                >
                    {rolesDisponibles.map((rol) => (<MenuItem key={rol.value} value={rol.value} className={styles.opcionSelect}> {rol.label} </MenuItem>))}
                </Select>
            </div>
        </div>
    );
}