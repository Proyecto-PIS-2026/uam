import { requerirConsultaProductores } from "@/modulos/identidad-acceso/autorizacion/controles";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import ContenedorPublicaciones from "@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones";
import { consultarPublicacionesProductores } from "@/modulos/consulta-mercado/acciones/PublicacionesProductor";

export const dynamic = "force-dynamic";

export default async function Page() {
    const sesion = await requerirConsultaProductores();
    const resultado = await consultarPublicacionesProductores(sesion);
    const publicaciones = resultado?.publicaciones ?? [];
    return (
        <div className="relative isolate flex-1 bg-background text-foreground">
            <main className="contenedor-pagina relative z-10 flex-1">
                <div className="secciones-pagina relative z-10">
                    <EncabezadoPagina titulo="Mercado Producción" cantidad={publicaciones.length} subtitulo="publicaciones en la plataforma" />
                    <ContenedorPublicaciones publicaciones={publicaciones} esAdmin={sesion.rol === "ADMINISTRADOR"} />
                </div>
            </main>
        </div>
    );
}
