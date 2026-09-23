import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/publicaciones";
import { PublicacionSinOperador } from "@/modulos/publicaciones/componentes/tarjetas-publicacion/TarjetaPublicacionSinOperador";

interface ListaPublicacionProp {
    publicaciones: PublicacionListado[]; 
    onPublicacionClick: (id: number) => void; 
}

export function ListaPublicacionSinOperador({publicaciones, onPublicacionClick}: ListaPublicacionProp) {
    const contenido = (
        <div className="flex flex-col gap-4 p-4 bg-white">
            {publicaciones.map((publicacion) => (
                <PublicacionSinOperador key={publicacion.id} producto={publicacion} onClick={() => onPublicacionClick(publicacion.id)}/>     
            ))}  
        </div>
    )
    return contenido; 
}