import { requerirConsultaProductores } from "@/modulos/identidad-acceso/autorizacion/controles";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import ContenedorPublicaciones from "@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones";
import obtenerPublicaciones from "@/modulos/consulta-mercado/acciones/ConsultarPublicacionProductor.action";
import { obtenerConfiguracionOrdenamiento } from "@/modulos/consulta-mercado/acciones/configuracion-ordenamiento";
import { convertirOrdenMercados } from "@/modulos/consulta-mercado/acciones/ordenamiento-publicaciones";

export const dynamic = "force-dynamic";

export default async function Page() {
    const sesion = await requerirConsultaProductores();

    const [resultado, configuracion] = await Promise.all([
        obtenerPublicaciones(sesion),
        obtenerConfiguracionOrdenamiento(),
    ]);

    const publicaciones = resultado?.publicaciones ?? [];

    const ordenInicial = convertirOrdenMercados(configuracion.ordenMercadoProduccion);

    return (
        <div className="relative isolate flex-1 bg-background text-foreground">
            <main className="contenedor-pagina relative z-10 flex-1">
                <div className="secciones-pagina relative z-10">
                    <EncabezadoPagina
                        titulo="Mercado Producción"
                        cantidad={publicaciones.length}
                        subtitulo="publicaciones en la plataforma"
                    />

                    <ContenedorPublicaciones
                        key={`${ordenInicial}-${configuracion.habilitado}`}
                        publicaciones={publicaciones}
                        esAdmin={sesion.rol === "ADMINISTRADOR"}
                        ordenInicial={ordenInicial}
                        ordenamientoHabilitado={configuracion.habilitado}
                    />
                </div>
            </main>
        </div>
    );
}