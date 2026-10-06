import type { UsuarioParaModificar } from "../../Compartidos/Tipos";

interface ListaUsuariosProps {
    usuarios: UsuarioParaModificar[];
    usuarioSeleccionadoId: number | null;
    onSeleccionar: ( usuario: UsuarioParaModificar ) => void;
}

export default function ListaUsuarios({usuarios, usuarioSeleccionadoId, onSeleccionar}: ListaUsuariosProps) {
    if (usuarios.length === 0) return <p>No se encontraron usuarios.</p>;

    return (
        <div>
            {usuarios.map((usuario) => (
                <button key={usuario.id} type="button" onClick={() => onSeleccionar(usuario)} aria-pressed={usuario.id === usuarioSeleccionadoId}>
                    <strong>{usuario.username}</strong>

                    <span> {obtenerNombreRol(usuario.rol)} </span>

                    <span> {obtenerDatoSecundario(usuario)} </span>

                    {usuario.id === usuarioSeleccionadoId && (<span>Seleccionado</span>)}
                </button>
            ))}
        </div>
    );
}

function obtenerNombreRol(rol: UsuarioParaModificar["rol"]): string {
    switch (rol) {
        case "ADMINISTRADOR":
            return "Administrador";

        case "OPERADOR":
            return "Operador";

        case "PRODUCTOR":
            return "Productor";
    }
}

function obtenerDatoSecundario(usuario: UsuarioParaModificar): string {
    switch (usuario.rol) {
        case "ADMINISTRADOR":
            return usuario.email;

        case "OPERADOR":
            return usuario.nombreFantasia;

        case "PRODUCTOR":
            return usuario.whatsApp;
    }
}