import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import ContenedorConfiguracionGeneral from "@/modulos/administracion/componentes/ContenedorConfiguracionGeneral";
import ContenedorConfiguracionPublicaciones from "@/modulos/administracion/componentes/ContenedorConfiguracionPublicaciones";
import ConfiguracionUsuarios from "@/modulos/administracion/componentes/configuracion-usuarios/ConfiguracionUsuarios";

export const dynamic = "force-dynamic";

export default function PaginaAdministracion() {
    return (
        <div className="relative isolate flex-1 bg-background text-foreground">
            <main className="contenedor-pagina relative z-10 flex-1">
                <div className="relative z-10 flex flex-col gap-6">
                    <EncabezadoPagina titulo="Panel Administrativo" cantidad={null} subtitulo="Configuración"/>
                    <ContenedorConfiguracionGeneral
                        publicaciones={<ContenedorConfiguracionPublicaciones/>}
                        usuarios={<ConfiguracionUsuarios/>}
                        publica={
                            <div>
                                <h2>Configuración pública</h2>
                                <p>Esta sección estará disponible próximamente.</p>
                            </div>
                        }
                    />
                </div>
            </main>
        </div>
    );
}