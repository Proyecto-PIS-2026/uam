import type { OperadorParaModificar } from "../../Compartidos/Tipos";

import EditarPerfilOperador from "./EditarPerfilOperador";
import RestablecerContrasena from "../Compartido/RestablecerContrasena";
import ManejarContratos from "./ManejarContratos";

interface ModificarOperadorProps {
    usuario: OperadorParaModificar;
}

export default function ModificarOperador({ usuario }: ModificarOperadorProps) {
    return (
        <div>
            <EditarPerfilOperador usuario={usuario}/>
            <RestablecerContrasena usuarioId={usuario.id}/>
            <ManejarContratos operadorId={usuario.id} locales={usuario.locales}/>
        </div>
    );
}