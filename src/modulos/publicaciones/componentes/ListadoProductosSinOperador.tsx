import { ProductoSinOperador, type Producto } from "@/modulos/publicaciones/componentes/TarjetaProductoSinOperador";

interface ListaProductosProp {
    productos: Producto[]; 
    onProductoClick: (id: number) => void; 
}

export function ListaProductosSinOperador( { productos, onProductoClick }: ListaProductosProp) {
    const contenido = (
        <div className="flex flex-col gap-4 p-4 bg-white">
            {productos.map((producto) => (
                <ProductoSinOperador
                    key={producto.id}
                    producto={producto}
                    onClick={onProductoClick}
                />     
            ))}  
        </div>
    )
    return contenido; 
}