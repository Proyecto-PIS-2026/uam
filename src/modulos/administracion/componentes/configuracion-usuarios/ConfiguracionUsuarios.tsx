import styles from "./ConfiguracionUsuarios.module.css";
import ModificarUsuario from "./Componentes/ModificarUsuario";
import consultarDatosModificarUsuarios from "./Acciones/ConsultaUsuarios";

export default async function ConfiguracionUsuarios() {
    const datos = await consultarDatosModificarUsuarios();
    return (
        <div className={styles.contenedor}>
            <ModificarUsuario datos={datos}/>
        </div>
    );
}