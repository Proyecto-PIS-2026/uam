import { PublicacionSinOperador, type Publicacion } from "@/modulos/publicaciones/componentes/TarjetaPublicacionSinOperador";

interface ListaPublicacionProp {
    nombreFantasia: string; 
    publicaciones: Publicacion[]; 
    onPublicacionClick: (id: number) => void; 
}

export function PublicacionesOperador( { nombreFantasia, publicaciones, onPublicacionClick } : ListaPublicacionProp) {
    const contenido = (
        <section className="px-4 py-0.5">
            <div className="border-t border-zinc-300">
                <div className="py-4">
                    <div className="font-semibold text-black text-lg mb-3">
                        {nombreFantasia}
                    </div>
                    <div className="flex flex-col gap-4">
                        {publicaciones.map((publicacion) => (
                            <PublicacionSinOperador
                                key={publicacion.id}
                                producto={publicacion}
                                onPublicacionClick={onPublicacionClick}
                            />     
                        ))}  
                    </div>
                </div>
            </div>
        </section>
    )
    return contenido; 
}