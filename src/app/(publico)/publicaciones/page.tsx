export const dynamic = 'force-dynamic';

// import HojasDecorativas from "@/compartido/HojasDecorativas";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import obtenerPublicaciones from "@/modulos/consulta-mercado/acciones/ConsultarPublicacion.action";
import ContenedorPublicaciones from "@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones";

type Props = {
    searchParams: Promise<{especie?: string}>;
};

export default async function PaginaPublicaciones({searchParams}: Props) {
    const parametros = await searchParams;
    const especie = parametros.especie ?? "";
    const resultado = await obtenerPublicaciones();
    const publicaciones = resultado?.publicaciones ?? [];
    return (
            <div className="relative isolate flex-1 bg-background text-foreground">
                {/* Decoración de fondo de toda la página */}
                {/* <HojasDecorativas variante="fondo" /> */}
                <main className="contenedor-pagina relative z-10 flex-1">
                    <div className="relative z-10 flex flex-col gap-6">
                        <EncabezadoPagina titulo="Publicaciones" cantidad={publicaciones.length} subtitulo="publicaciones en la plataforma" />
                        <ContenedorPublicaciones key={especie} publicaciones={publicaciones} especie={especie}/>
                    </div>
                </main>
            </div>
    );
}
