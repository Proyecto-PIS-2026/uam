export const dynamic = "force-dynamic";

import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import ListadoConfiguracionesGenerales from "@/modulos/administracion/componentes/ListadoConfiguracionesGenerales";
import obtenerConfiguraciones from "@/modulos/administracion/consulta-configuracion";

export default async function PaginaAdministracionGeneral() {
    const filas = await obtenerConfiguraciones();

    const configuracion: Record<string, string | null> = Object.fromEntries(
        filas.map(({ nombreConfiguracion, valorConfiguracion }) => [
            nombreConfiguracion,
            valorConfiguracion,
        ])
    );

    const contenido = (
        <div className="relative isolate flex-1 bg-background text-foreground">
            <main className="contenedor-pagina relative z-10 flex-1">
                <div className="relative z-10 flex flex-col gap-6">
                    <EncabezadoPagina titulo="Panel Administrativo" cantidad={null} subtitulo="Publicaciones"/>
                    <ListadoConfiguracionesGenerales configuracion={configuracion}/>
                </div>
            </main>
        </div>
    );

    return contenido;
}
