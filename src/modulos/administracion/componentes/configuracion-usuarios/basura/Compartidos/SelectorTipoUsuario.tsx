import type { TipoUsuario } from "../../Tipos";

interface SelectorSinTodosProps {
    value: TipoUsuario;
    onChange: (tipo: TipoUsuario) => void;
    mostrarTodos?: false;
    id?: string;
}

interface SelectorConTodosProps {
    value: TipoUsuario | "TODOS";
    onChange: (tipo: TipoUsuario | "TODOS") => void;
    mostrarTodos: true;
    id?: string;
}

type SelectorTipoUsuarioProps = | SelectorSinTodosProps | SelectorConTodosProps;

const opciones: { value: TipoUsuario; label: string }[] = [
    {
        value: "ADMINISTRADOR",
        label: "Administrador",
    },
    {
        value: "OPERADOR",
        label: "Operador",
    },
    {
        value: "PRODUCTOR",
        label: "Productor",
    },
];

export default function SelectorTipoUsuario(props: SelectorTipoUsuarioProps) {
    const id = props.id ?? "tipo-usuario";
    function manejarCambio(valor: string) {
        if (props.mostrarTodos) {
            props.onChange(valor === "TODOS" ? "TODOS" : (valor as TipoUsuario));
            return;
        }
        props.onChange(valor as TipoUsuario);
    }

    return (
        <div>
            <label htmlFor={id}> Tipo de usuario </label>
            <select id={id} value={props.value} onChange={(event) => manejarCambio(event.target.value)}>
                {props.mostrarTodos && (<option value="TODOS"> Todos </option>)}
                {opciones.map((opcion) => (
                    <option key={opcion.value} value={opcion.value}> {opcion.label} </option>
                ))}
            </select>
        </div>
    );
}