import { PublicacionSinOperador, type Publicacion } from "@/modulos/publicaciones/componentes/TarjetaPublicacionSinOperador";

interface ListaPublicacionProp {
    nombreFantasia: string; 
    publicaciones: Publicacion[]; 
    onProductoClick: (id: number) => void; 
}

export function PublicacionesOperador( { nombreFantasia, publicaciones, onProductoClick } : ListaPublicacionProp) {
    const contenido = (
        <section className="bg-white px-4 py-0.5">
            <div className="border-t border-zinc-300">
                <div className="py-4">
                    <div className="font-semibold text-black mb-4">
                        {nombreFantasia}
                    </div>
                    <div className="flex flex-col gap-4">
                        {publicaciones.map((publicacion) => (
                            <PublicacionSinOperador
                                key={publicacion.id}
                                producto={publicacion}
                                onClick={onProductoClick}
                            />     
                        ))}  
                    </div>
                </div>
            </div>
        </section>
    )
    return contenido; 
}