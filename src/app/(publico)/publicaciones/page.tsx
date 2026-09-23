import HeaderPublico from '@/compartido/HeaderPublico';
import { consultarPublicaciones } from "@/modulos/consulta-mercado/acciones/publicaciones";
import ContenedorPublicaciones from "@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones";

export default async function PaginaPublicaciones() {
    const resultado = await consultarPublicaciones();
    return (
		<>
			<HeaderPublico/>
			<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
				<div className="mb-6 rounded-xl bg-[var(--color-secondary)] px-6 py-8">
					<h1 className="text-2xl font-semibold text-white"> Catálogo </h1>
					<p className="mt-1 text-sm text-[rgb(168,208,93)]">
						<span className="font-semibold">{resultado.publicaciones.length}</span>{" "}
						publicaciones en la plataforma
					</p>
				</div>
				<ContenedorPublicaciones publicaciones={resultado.publicaciones}/>     
			</main>
		</>
    )
}