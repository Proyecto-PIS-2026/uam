export const dynamic = "force-dynamic";

import obtenerConfiguraciones from "@/modulos/administracion/consulta-configuracion";
import ContenedorConfiguracion from "@/modulos/administracion/componentes/ListadoConfiguracionesPublicaciones";

export default async function PaginaAdministracionPublicaciones() {
    const [filas, ] = await Promise.all([obtenerConfiguraciones()]);
    const configuracion = Object.fromEntries(filas.map(({ nombreConfiguracion, valorConfiguracion }) => [nombreConfiguracion, valorConfiguracion]));
    const contenido = (
        <div className="relative isolate flex-1 bg-background text-foreground">
            <main className="contenedor-pagina relative z-10 flex-1">
                <div className="relative z-10 flex flex-col gap-6">
                    <ContenedorConfiguracion configuracion={configuracion}/>
                </div>
            </main>
        </div>
    );
    return contenido; 
}