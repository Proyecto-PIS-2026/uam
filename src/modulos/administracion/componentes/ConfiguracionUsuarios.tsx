import AltaUsuario from "./AltaUsuario/AltaUsuario";
import ModificarUsuario from "./ModificarUsuario/ModificarUsuario";
import consultarDatosModificarUsuarios  from "../acciones/ConsultaUsuarios";
import type { DatosModificarUsuarios } from "./Compartidos/Tipos";

export default async function ConfiguracionUsuarios() {
    const resultadoConsulta = await consultarDatosModificarUsuarios();
    const datos: DatosModificarUsuarios = { usuarios: resultadoConsulta.usuarios };
    return (
        <div>
            <section>
                <h2>Alta de usuario</h2>
                <AltaUsuario/>
            </section>

            <section>
                <h2>Modificar Usuario</h2>
                <ModificarUsuario datos={datos} />
            </section>
        </div>
    );
}