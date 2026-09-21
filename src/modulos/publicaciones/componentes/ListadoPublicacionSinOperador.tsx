import { PublicacionSinOperador, type Publicacion } from "@/modulos/publicaciones/componentes/TarjetaPublicacionSinOperador";

interface ListaPublicacionProp {
    publicaciones: Publicacion[]; 
    onProductoClick: (id: number) => void; 
}

export function ListaPublicacionSinOperador( { publicaciones, onProductoClick }: ListaPublicacionProp) {
    const contenido = (
        <div className="flex flex-col gap-4 p-4 bg-white">
            {publicaciones.map((publicacion) => (
                <PublicacionSinOperador
                    key={publicacion.id}
                    producto={publicacion}
                    onClick={onProductoClick}
                />     
            ))}  
        </div>
    )
    return contenido; 
}