"use client";

import type { PublicacionListado } from "../../consulta-mercado/acciones/publicaciones";

//import { PublicacionesOperador } from "@/modulos/publicaciones/componentes/ListadoPublicacionConOperador";
//import { PublicacionSinOperador } from "@/modulos/publicaciones/componentes/TarjetaPublicacionSinOperador";
import TarjetaPublicacionConOperador from "@/modulos/publicaciones/componentes/TarjetaPublicacionOperadorAlt";
import TarjetaPublicacionSinOperador from "@/modulos/publicaciones/componentes/TarjetaPublicacionSinOperadorAlt";
import { useMemo, useState } from "react";

import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";

type PublicacionesAgrupadas = {
	id: number;
	nombreFantasia: string;
	publicaciones: PublicacionListado[];
};

const clasesLista = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

export default function ListadoPublicaciones({publicaciones} : {publicaciones: PublicacionListado[]}) {
	const [agruparPorOperador, setAgruparPorOperador] = useState(false);
	const publicacionesAgrupadas = useMemo(() => {
		const grupos = new Map<number, PublicacionesAgrupadas>();
		for (const publicacion of publicaciones) {
			const grupo = grupos.get(publicacion.operador.id);
			if (grupo) {
				grupo.publicaciones.push(publicacion);
			} else {
				grupos.set(publicacion.operador.id, {
				id: publicacion.operador.id,
				nombreFantasia: publicacion.operador.nombreFantasia,
				publicaciones: [publicacion]
				});
			}
		}
		return Array.from(grupos.values());
	}, [publicaciones]);

	if (publicaciones.length === 0) return (<p role="status"> No hay publicaciones que coincidan con la búsqueda. </p>);

	return (
		<div>
			<div className="mb-6 flex items-center justify-between border-b border-[var(--color-border)] pb-4">
				<h1 className="text-2xl font-semibold text-[var(--color-secondary)]"> Publicaciones </h1>
				<button type="button" onClick={() => setAgruparPorOperador(!agruparPorOperador)}
					className={`inline-flex w-33 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-200 active:scale-95 
						${agruparPorOperador ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]" : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] text-[var(--color-primary)]"}`}>
					{agruparPorOperador ? (<> <ViewListIcon fontSize="small" /> Desagrupar </>) : (<> <ViewModuleIcon fontSize="small" /> Agrupar </>)}
				</button>
			</div>
			{agruparPorOperador ? (
				<div>
					{publicacionesAgrupadas.map((operador) => (
						<div key={operador.id}>
							<div className="mb-4 mt-8">
								<h2 className="text-lg font-semibold text-[var(--color-primary)]"> {operador.nombreFantasia} </h2>
								<div className="mt-1 flex items-center gap-3">
									<div className="text-sm text-[var(--color-muted)]">
										<span className="font-semibold text-[var(--color-primary)]"> {operador.publicaciones.length} </span>{" "} productos
									</div>
									<div className="h-px flex-1 bg-[var(--color-border)]"/>
								</div>
							</div>
							<ul className={clasesLista}>
								{operador.publicaciones.map((publicacion) => (
									<li key={publicacion.id}>
										<TarjetaPublicacionSinOperador publicacion={publicacion}/>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			) : (
				<ul className={clasesLista}>
					{publicaciones.map((publicacion) => (
						<li key={publicacion.id}>
							<TarjetaPublicacionConOperador publicacion={publicacion}/>
						</li>
					))}
				</ul>
			)}
		</div>
  	);
}