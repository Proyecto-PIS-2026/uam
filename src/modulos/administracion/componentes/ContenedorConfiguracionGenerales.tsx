import ListadoConfiguracionesGenerales from "@/modulos/administracion/componentes/ListadoConfiguracionesGenerales";
import obtenerConfiguraciones from "@/modulos/administracion/consulta-configuracion";

export default async function PaginaAdministracionGeneral() {
    const filas = await obtenerConfiguraciones();

    const configuracion: Record<string, string | null> = Object.fromEntries(
        filas.map(({ nombreConfiguracion, valorConfiguracion }) => [
            nombreConfiguracion,
            valorConfiguracion,
        ]),
    );

    return (
        <ListadoConfiguracionesGenerales configuracion={configuracion} />
    );
}