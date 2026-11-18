import EncabezadoPagina from "@/compartido/componentes/EncabezadoPagina";
import PanelAdministracion from "@/modulos/administracion/componentes/contenedor-configuracion/PanelAdministracion";
import ConfiguracionGeneral from "@/modulos/administracion/configuracion/componentes/ConfiguracionGeneral";
import ConfiguracionUsuarios from "@/modulos/administracion/usuarios/componentes/ConfiguracionUsuarios";
import ContenedorEstadistica from "@/modulos/administracion/estadisticas/componentes/ContenedorEstadistica";
import { obtenerEstadisticas } from "../../../modulos/administracion/estadisticas/consultas-estadisticas";
import consultarDatosModificarUsuarios from "@/modulos/administracion/usuarios/consultas/consultas-usuarios";
import { requerirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import CatalogosPublicacion from "@/modulos/administracion/catalogos/componentes/CatalogosPublicacion";

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
                    <PanelAdministracion
                        general={<ConfiguracionGeneral />}
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
