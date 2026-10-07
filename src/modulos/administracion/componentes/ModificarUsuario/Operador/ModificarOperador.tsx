import type { OperadorParaModificar } from "../../Compartidos/Tipos";

import EditarPerfilOperador from "./EditarPerfilOperador";
import RestablecerContrasena from "../Compartido/RestablecerContrasena";
import ManejarContratos from "./ManejarContratos";

import styles from "./ModificarOperador.module.css"

interface ModificarOperadorProps {
    usuario: OperadorParaModificar;
}

export default function ModificarOperador({ usuario }: ModificarOperadorProps) {
    return (
        <div className={styles.contenedor}>
            <EditarPerfilOperador key={usuario.id} usuario={usuario}/>
            <RestablecerContrasena key={`contrasena-${usuario.id}`} usuarioId={usuario.id}/>
            <ManejarContratos key={`contratos-${usuario.id}`} operadorId={usuario.operadorId} locales={usuario.locales}/>
        </div>
    );
}