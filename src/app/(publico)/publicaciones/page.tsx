import HeaderPublico from "@/compartido/HeaderPublico";
import HojasDecorativas from "@/compartido/HojasDecorativas";
import obtenerPublicaciones from "@/modulos/consulta-mercado/acciones/ConsultarPublicacion.action";
import ContenedorPublicaciones from "@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones";

type Props = {
    searchParams: Promise<{especie?: string}>;
};

export default async function PaginaPublicaciones({searchParams}: Props) {
    const {especie} = await searchParams;
    const resultado = await obtenerPublicaciones();
    const publicaciones = resultado?.publicaciones ?? [];
    return (
        <>
            <HeaderPublico />
            <div className="relative min-h-screen">
                {/* Decoración de fondo de toda la página */}
                <div className="pointer-events-none absolute inset-0 -z-10">
                    <HojasDecorativas variante="fondo" />
                </div>
                <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
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
                                        {publicaciones.length}
                                    </span>{" "}
                                    publicaciones en la plataforma
                                </p>
                            </div>
                        </div>
                        <ContenedorPublicaciones publicaciones={publicaciones} especie={especie}/>
                    </div>
                </main>
            </div>
        </>
    );
}