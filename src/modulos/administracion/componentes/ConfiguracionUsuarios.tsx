import styles from "./ConfiguracionUsuarios.module.css";
import AltaUsuario from "./AltaUsuario/AltaUsuario";
import ModificarUsuario from "./ModificarUsuario/ModificarUsuario";
import consultarDatosModificarUsuarios from "../acciones/ConsultaUsuarios";

export default async function ConfiguracionUsuarios() {
    const datos = await consultarDatosModificarUsuarios();
    return (
        <div className={styles.contenedor}>
            <AltaUsuario/>
            <ModificarUsuario datos={datos}/>
        </div>
    );
}