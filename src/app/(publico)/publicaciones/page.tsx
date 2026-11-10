import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import { redirigirAMercadoPropio } from "@/modulos/identidad-acceso/autorizacion/controles";
import obtenerPublicaciones from "@/modulos/consulta-mercado/acciones/ConsultarPublicacionOperador.action";
import ContenedorPublicaciones from "@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones";
import { obtenerConfiguracionOrdenamiento } from "@/modulos/consulta-mercado/acciones/configuracion-ordenamiento";
import { convertirOrdenMercados } from "@/modulos/consulta-mercado/acciones/ordenamiento-publicaciones";

export const dynamic = "force-dynamic";

type Props = {
    searchParams: Promise<{ especie?: string }>;
};

export default async function PaginaPublicaciones({searchParams}: Props) {
    const sesion = await redirigirAMercadoPropio();
    const esAdmin = sesion?.rol === "ADMINISTRADOR";

    const parametros = await searchParams;
    const especie = parametros.especie ?? "";

    const [resultado, configuracion] = await Promise.all([
        obtenerPublicaciones({ especie }),
        obtenerConfiguracionOrdenamiento(),
    ]);

    if (!resultado) {
        throw new Error("No se pudieron cargar las publicaciones.");
    }

    const ordenInicial = convertirOrdenMercados(configuracion.ordenMercadoVirtual);

    const contenido = (
        <div className="relative isolate flex-1 bg-background text-foreground">
            <main className="contenedor-pagina relative z-10 flex-1">
                <div className="secciones-pagina relative z-10">
                    <EncabezadoPagina
                        titulo="Mercado Virtual"
                        cantidad={resultado.totalCatalogo}
                        subtitulo={resultado.totalCatalogo === 1 ? "publicación en la plataforma" : "publicaciones en la plataforma"}
                    />
                    <ContenedorPublicaciones
                        key={`${especie}-${ordenInicial}-${configuracion.habilitado}`}
                        resultado={resultado}
                        especie={especie}
                        esAdmin={esAdmin}
                        ordenInicial={ordenInicial}
                        ordenamientoHabilitado={configuracion.habilitado}
                    />
                </div>
            </main>
        </div>
    );
    return contenido; 
}