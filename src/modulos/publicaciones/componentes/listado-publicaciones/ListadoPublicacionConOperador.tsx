"use client";

import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/publicaciones";
import PublicacionConOperador from "@/modulos/publicaciones/componentes/tarjetas-publicacion/TarjetaPublicacionConOperador";

interface ListaPublicacionProp {
    nombreFantasia: string;
    publicaciones: PublicacionListado[];
    onPublicacionClick: (id: number) => void;
}

export function PublicacionesOperador({nombreFantasia, publicaciones, onPublicacionClick}: ListaPublicacionProp) {
    const contenido = (
        <section className="px-4 py-0.5">
            <div className="border-t border-zinc-300">
                <div className="py-4">
                    <div className="font-semibold text-black text-lg mb-3">
                        {nombreFantasia}
                    </div>
                    <div className="flex flex-col gap-4">
                        {publicaciones.map((publicacion) => (
                            <PublicacionConOperador key={publicacion.id} publicacion={publicacion} onClick={() => onPublicacionClick(publicacion.id)}/>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
    return contenido;
}
