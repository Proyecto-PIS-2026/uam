export const dynamic = "force-dynamic";

import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import obtenerConfiguraciones from "@/modulos/administracion/consulta-configuracion";
import obtenerEspecies from "@/modulos/administracion/consulta-especies";
import ContenedorConfiguracion from "@/modulos/administracion/componentes/ListadoConfiguracionesPublicaciones";

export default async function PaginaAdministracionPublicaciones() {
    const [filas, especies] = await Promise.all([
    obtenerConfiguraciones(),
        obtenerEspecies(),
    ]);
    const configuracion = Object.fromEntries(filas.map(({ nombreConfiguracion, valorConfiguracion }) => [nombreConfiguracion, valorConfiguracion]));
    const contenido = (
        <div className="relative isolate flex-1 bg-background text-foreground">
            <main className="contenedor-pagina relative z-10 flex-1">
                <div className="relative z-10 flex flex-col gap-6">
                    <EncabezadoPagina titulo="Panel Administrativo" cantidad={null} subtitulo="Publicaciones"/>
                    <ContenedorConfiguracion configuracion={configuracion} especies={especies}/>
                </div>
            </main>
        </div>
    );
    return contenido; 
}