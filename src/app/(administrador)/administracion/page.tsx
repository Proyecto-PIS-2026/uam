export const dynamic = 'force-dynamic';

// import HojasDecorativas from "@/compartido/HojasDecorativas";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import obtenerConfiguracion from "@/modulos/administracion/consulta-configuracion";
import ContenedorConfiguracion from "@/modulos/administracion/componentes/ContenedorConfiguracion";

export default async function PaginaAdministracion() {
    const filas = await obtenerConfiguracion();
    const configuracion = Object.fromEntries(filas.map(({ nombreConfiguracion, valorConfiguracion }) => [ nombreConfiguracion, valorConfiguracion]));
    return (
            <div className="relative isolate flex-1 bg-background text-foreground">
                {/* Decoración de fondo de toda la página */}
                {/* <HojasDecorativas variante="fondo" /> */}
                <main className="contenedor-pagina relative z-10 flex-1">
                    <div className="relative z-10 flex flex-col gap-6">
                        <EncabezadoPagina titulo="Panel Administrativo" cantidad={1} subtitulo="administracion general" />
                        <ContenedorConfiguracion configuracion={configuracion}/>
                    </div>
                </main>
            </div>
    );
}
