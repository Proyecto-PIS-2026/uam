import styles from "./ConfiguracionUsuarios.module.css";
import ModificarUsuario from "./componentes/ModificarUsuario";

interface ConfiguracionUsuariosProps {
    datos: Awaited<ReturnType<typeof import("./acciones/ConsultaUsuarios").default>>;
}

export default function ConfiguracionUsuarios({ datos }: ConfiguracionUsuariosProps) {
    return (
        <div className={styles.contenedor}>
            <ModificarUsuario datos={datos} />
        </div>
    );
}