import styles from "./ConfiguracionUsuarios.module.css";
import ModificarUsuario from "./ModificarUsuario";

interface ConfiguracionUsuariosProps {
    datos: Awaited<ReturnType<typeof import("../consultas/consultas-usuarios").default>>;
}

export default function ConfiguracionUsuarios({ datos }: ConfiguracionUsuariosProps) {
    return (
        <div className={styles.contenedor}>
            <ModificarUsuario datos={datos} />
        </div>
    );
}