export const dynamic = 'force-dynamic';

import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import { redirigirOperadorAMiMercado } from "@/modulos/identidad-acceso/autorizacion/controles";
import obtenerPublicaciones from "@/modulos/consulta-mercado/acciones/ConsultarPublicacion.action";
import ContenedorPublicaciones from "@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones";

type Props = {
    searchParams: Promise<{especie?: string}>;
};

export default async function PaginaPublicaciones({searchParams}: Props) {
    await redirigirOperadorAMiMercado();
    const parametros = await searchParams;
    const especie = parametros.especie ?? "";
    const resultado = await obtenerPublicaciones({ especie });
    if (!resultado) throw new Error("No se pudieron cargar las publicaciones.");
    return (
            <div className="relative isolate flex-1 bg-background text-foreground">
                <main className="contenedor-pagina relative z-10 flex-1">
                    <div className="secciones-pagina relative z-10">
                        <EncabezadoPagina titulo="Publicaciones" cantidad={resultado.totalCatalogo} subtitulo="publicaciones en la plataforma" />
                        <ContenedorPublicaciones key={especie} resultado={resultado} especie={especie}/>
                    </div>
                </main>
            </div>
    );
}
