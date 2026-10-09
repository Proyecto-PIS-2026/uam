import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import ContenedorConfiguracionGeneral from "@/modulos/administracion/componentes/ContenedorConfiguracionGeneral";
import ContenedorConfiguracionPublicaciones from "@/modulos/administracion/componentes/ContenedorConfiguracionPublicaciones";
import ContenedorConfiguracionGenerales from "@/modulos/administracion/componentes/configuracion-general/ContenedorConfiguracionGenerales";
import ConfiguracionUsuarios from "@/modulos/administracion/componentes/configuracion-usuarios/ConfiguracionUsuarios";

import obtenerConfiguraciones from "@/modulos/administracion/Consulta-Configuracion";
import consultarDatosModificarUsuarios from "@/modulos/administracion/componentes/configuracion-usuarios/acciones/ConsultaUsuarios";

export const dynamic = "force-dynamic";

export default async function PaginaAdministracion() {
    const [filasConfiguracion, datosUsuarios] = await Promise.all([
        obtenerConfiguraciones(),
        consultarDatosModificarUsuarios(),
    ]);

    const configuracion: Record<string, string | null> = Object.fromEntries(
        filasConfiguracion.map(({ nombreConfiguracion, valorConfiguracion }) => [
            nombreConfiguracion,
            valorConfiguracion,
        ])
    );

    return (
        <div className="relative isolate flex-1 bg-background text-foreground">
            <main className="contenedor-pagina relative z-10 flex-1">
                <div className="relative z-10 flex flex-col gap-6">
                    <EncabezadoPagina titulo="Panel Administrativo" cantidad={null} subtitulo="Configuración" />
                    <ContenedorConfiguracionGeneral
                        publicaciones={<ContenedorConfiguracionPublicaciones configuracion={configuracion} />}
                        usuarios={<ConfiguracionUsuarios datos={datosUsuarios} />}
                        publica={<ContenedorConfiguracionGenerales/>}
                    />
                </div>
            </main>
        </div>
    );
}