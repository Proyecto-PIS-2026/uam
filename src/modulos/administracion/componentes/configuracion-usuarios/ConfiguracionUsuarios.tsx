import styles from "./ConfiguracionUsuarios.module.css";
import ModificarUsuario from "./componentes/ModificarUsuario";
import consultarDatosModificarUsuarios from "./acciones/ConsultaUsuarios";

export default async function ConfiguracionUsuarios() {
    const datos = await consultarDatosModificarUsuarios();
    return (
        <div className={styles.contenedor}>
            <ModificarUsuario datos={datos}/>
        </div>
    );
}