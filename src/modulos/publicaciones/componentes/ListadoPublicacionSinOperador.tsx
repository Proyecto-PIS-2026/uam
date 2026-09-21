import { ProductoSinOperador, type Publicacion } from "@/modulos/publicaciones/componentes/TarjetaPublicacionSinOperador";

interface ListaProductosProp {
    publicaciones: Publicacion[]; 
    onProductoClick: (id: number) => void; 
}

export function ListaProductosSinOperador( { publicaciones, onProductoClick }: ListaProductosProp) {
    const contenido = (
        <div className="flex flex-col gap-4 p-4 bg-white">
            {publicaciones.map((publicacion) => (
                <ProductoSinOperador
                    key={publicacion.id}
                    producto={publicacion}
                    onClick={onProductoClick}
                />     
            ))}  
        </div>
    )
    return contenido; 
}