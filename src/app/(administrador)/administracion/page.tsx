import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import ContenedorConfiguracionGeneral from "@/modulos/administracion/componentes/contenedor-configuracion/ContenedorConfiguraciones";
import ContenedorConfiguracionGenerales from "@/modulos/administracion/componentes/configuracion-general/contenedor-configuracion-general/ContenedorConfiguracionGenerales";
import ConfiguracionUsuarios from "@/modulos/administracion/componentes/configuracion-usuarios/ConfiguracionUsuarios";
import ContenedorEstadistica from "@/modulos/administracion/componentes/estadistica/ContenedorEstadistica";
import { obtenerEstadisticas } from "@/modulos/administracion/acciones/consultas-configuracion";
import consultarDatosModificarUsuarios from "@/modulos/administracion/componentes/configuracion-usuarios/acciones/ConsultaUsuarios";
import { requerirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import CatalogosPublicacion from "@/modulos/administracion/componentes/catalogos-publicacion/CatalogosPublicacion";

export const dynamic = "force-dynamic";

export default async function PaginaAdministracion() {
    const sesion = await requerirAdministrador();

    const [datosUsuarios, estadisticas] = await Promise.all([
        consultarDatosModificarUsuarios(sesion.usuarioId),
        obtenerEstadisticas(),
    ]);

    const contenido = (
        <div className="relative isolate flex-1 bg-background text-foreground">
            <main className="contenedor-pagina relative z-10 flex-1">
                <div className="secciones-pagina relative z-10">
                    <EncabezadoPagina
                        titulo="Panel Administrativo"
                        cantidad={null}
                        subtitulo="Configuración"
                    />
                    <ContenedorConfiguracionGeneral
                        general={<ContenedorConfiguracionGenerales />}
                        usuarios={<ConfiguracionUsuarios datos={datosUsuarios} />}
                        estadisticas={<ContenedorEstadistica datosIniciales={estadisticas} />}
                        catalogos={<CatalogosPublicacion />}
                    />
                </div>
            </main>
        </div>
    );

    return contenido;
}
