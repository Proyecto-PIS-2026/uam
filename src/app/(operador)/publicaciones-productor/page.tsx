import { requerirConsultaProductores } from "@/modulos/identidad-acceso/autorizacion/controles";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import ContenedorPublicaciones from "@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones";
import obtenerPublicaciones from "@/modulos/consulta-mercado/acciones/ConsultarPublicacionProductor.action";

export const dynamic = "force-dynamic";

export default async function Page() {
    const sesion = await requerirConsultaProductores();
    const resultado = await obtenerPublicaciones(sesion);
    const publicaciones = resultado?.publicaciones ?? [];
    return (
        <div className="relative isolate flex-1 bg-background text-foreground">
            <main className="contenedor-pagina relative z-10 flex-1">
                <div className="relative z-10 flex flex-col gap-6">
                    <EncabezadoPagina titulo="Publicaciones" cantidad={publicaciones.length} subtitulo="publicaciones en la plataforma" />
                    <ContenedorPublicaciones publicaciones={publicaciones} />
                </div>
            </main>
        </div>
    );
}