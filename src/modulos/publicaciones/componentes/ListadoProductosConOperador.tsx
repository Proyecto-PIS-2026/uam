import { ProductoSinOperador, type Producto } from "@/modulos/publicaciones/componentes/TarjetaProductoSinOperador";

interface ListaProductosProp {
    nombreFantasia: string; 
    productos: Producto[]; 
    onProductoClick: (id: number) => void; 
}

export function PublicacionesOperador( { nombreFantasia, productos, onProductoClick } : ListaProductosProp) {
    const contenido = (
        <section className="bg-white px-4 py-0.5">
            <div className="border-t border-zinc-300">
                <div className="py-4">
                    <div className="font-semibold text-black mb-4">
                        {nombreFantasia}
                    </div>
                    <div className="flex flex-col gap-4">
                        {productos.map((producto) => (
                            <ProductoSinOperador
                                key={producto.id}
                                producto={producto}
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