import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import ContenedorConfiguracionGeneral from "@/modulos/administracion/componentes/contenedor-configuracion/ContenedorConfiguracionGeneral";
import ContenedorConfiguracionGenerales from "@/modulos/administracion/componentes/configuracion-general/contenedor-configuracion-general/ContenedorConfiguracionGenerales";
import ConfiguracionUsuarios from "@/modulos/administracion/componentes/configuracion-usuarios/ConfiguracionUsuarios";

import obtenerConfiguraciones from "@/modulos/administracion/acciones/consultas-configuracion";
import consultarDatosModificarUsuarios from "@/modulos/administracion/componentes/configuracion-usuarios/acciones/ConsultaUsuarios";
import { requerirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";

export const dynamic = "force-dynamic";

export default async function PaginaAdministracion() {
    await requerirAdministrador();

    const [filasConfiguracion, datosUsuarios] = await Promise.all([
        obtenerConfiguraciones(["incremento_precio"]),
        consultarDatosModificarUsuarios(),
    ]);

    return (
        <div className="relative isolate flex-1 bg-background text-foreground">
            <main className="contenedor-pagina relative z-10 flex-1">
                <div className="secciones-pagina relative z-10">
                    <EncabezadoPagina titulo="Panel Administrativo" cantidad={null} subtitulo="Configuración" />
                    <ContenedorConfiguracionGeneral
                        general={<ContenedorConfiguracionGenerales/>}
                        usuarios={<ConfiguracionUsuarios datos={datosUsuarios} />}
                    />
                </div>
            </main>
        </div>
    );
}
