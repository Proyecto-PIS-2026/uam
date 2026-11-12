import ListadoConfiguracionesGenerales from "../listado-configuracion-general/ListadoConfiguracionesGenerales";
import obtenerConfiguraciones from "@/modulos/administracion/acciones/consultas-configuracion";
import obtenerEspecies from "@/modulos/administracion/acciones/consultas-especies";
import { CLAVES_VIGENCIA_PUBLICACIONES } from "@/modulos/publicaciones/claves-vigencia-publicaciones";

export default async function PaginaAdministracionGeneral() {
    const [filas, especies] = await Promise.all([
        obtenerConfiguraciones([
            "url_lista_inteligente", 
            "incremento_precio", 
            "ordenamiento_habilitado", "orden_landing_page_default", "orden_mercado_virtual_default", "orden_mercado_produccion_default",
            "aging_fotos_habilitado", "vigencia_fotos", "aviso_vencimiento_fotos_habilitado", "anticipacion_aviso_fotos",
            ...CLAVES_VIGENCIA_PUBLICACIONES.OPERADOR,
            ...CLAVES_VIGENCIA_PUBLICACIONES.PRODUCTOR,
            "restablecimiento_contrasena_habilitado",
        ]),
        obtenerEspecies(),
    ]);

    const configuracion: Record<string, string | null> = Object.fromEntries(
        filas.map(({ nombreConfiguracion, valorConfiguracion }) => [
            nombreConfiguracion,
            valorConfiguracion,
        ]),
    );

    const contenido= (
        <ListadoConfiguracionesGenerales
            configuracion={configuracion}
            especies={especies}
        />
    );
    return contenido; 
}
