import type { TipoUsuario } from "../../Compartidos/Tipos";
import SelectorTipoUsuario from "../../Compartidos/SelectorTipoUsuario";


interface BuscadorUsuariosProps {
    busqueda: string;
    tipoUsuario: TipoUsuario | "TODOS";
    onBusquedaChange: (valor: string) => void;
    onTipoUsuarioChange: (tipo: TipoUsuario | "TODOS") => void;
}

export default function BuscadorUsuarios({ busqueda, tipoUsuario, onBusquedaChange, onTipoUsuarioChange}: BuscadorUsuariosProps) {
    return (
        <div>
            <div>
                <label htmlFor="busqueda-usuario"> Buscar usuario </label>
                <input id="busqueda-usuario" type="text" value={busqueda} onChange={(event) => onBusquedaChange(event.target.value) } placeholder={obtenerPlaceholder(tipoUsuario)}/>
            </div>
            <SelectorTipoUsuario value={tipoUsuario} onChange={onTipoUsuarioChange} mostrarTodos/>
        </div>
    );
}

function obtenerPlaceholder(tipoUsuario: TipoUsuario | "TODOS"): string {
    switch (tipoUsuario) {
        case "ADMINISTRADOR":
            return "Username o email";

        case "OPERADOR":
            return "Username o nombre fantasía";

        case "PRODUCTOR":
            return "Username";

        default:
            return "Username";
    }
}