import HeaderPublico from "@/compartido/HeaderPublico";
import HojasDecorativas from "@/compartido/HojasDecorativas";
import { consultarPublicaciones } from "@/modulos/consulta-mercado/acciones/publicaciones";
import ContenedorPublicaciones from "@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones";

export default async function PaginaPublicaciones() {
    const resultado = await consultarPublicaciones();
    return (
        <>
            <HeaderPublico />
            <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
                {/* Decoración de fondo de toda la página */}
                <HojasDecorativas variante="fondo" />
                {/* Contenido por encima de las hojas */}
                <div className="relative z-10">
                    <div className="relative mb-6 overflow-hidden rounded-xl bg-[var(--color-secondary)] px-6 py-8">
                        {/* Decoración del encabezado */}
                        <HojasDecorativas variante="separador" />
                        {/* Contenido del encabezado */}
                        <div className="relative z-10">
                            <h1 className="text-2xl font-semibold text-white">
                                Catálogo
                            </h1>
                            <p className="mt-1 text-sm text-[rgb(168,208,93)]">
                                <span className="font-semibold">
                                    {resultado.publicaciones.length}
                                </span>{" "}
                                publicaciones en la plataforma
                            </p>
                        </div>
                    </div>
                    <ContenedorPublicaciones publicaciones={resultado.publicaciones}/>
                </div>
            </main>
        </>
    );
}