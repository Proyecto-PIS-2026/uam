import ListadoConfiguracionesGenerales from "@/modulos/administracion/componentes/configuracion-general/ListadoConfiguracionesGenerales";
import obtenerConfiguraciones from "@/modulos/administracion/Consulta-Configuracion";

export default async function PaginaAdministracionGeneral() {
    const filas = await obtenerConfiguraciones();

    const configuracion: Record<string, string | null> = Object.fromEntries(
        filas.map(({ nombreConfiguracion, valorConfiguracion }) => [
            nombreConfiguracion,
            valorConfiguracion,
        ]),
    );
    return (<ListadoConfiguracionesGenerales configuracion={configuracion}/>);
}