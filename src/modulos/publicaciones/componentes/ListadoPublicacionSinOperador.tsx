import { PublicacionSinOperador, type Publicacion } from "@/modulos/publicaciones/componentes/TarjetaPublicacionSinOperador";

interface ListaPublicacionProp {
    publicaciones: Publicacion[]; 
    onPublicacionClick: (id: number) => void; 
}

export function ListaPublicacionSinOperador( { publicaciones, onPublicacionClick }: ListaPublicacionProp) {
    const contenido = (
        <div className="flex flex-col gap-4 p-4 bg-white">
            {publicaciones.map((publicacion) => (
                <PublicacionSinOperador
                    key={publicacion.id}
                    producto={publicacion}
                    onPublicacionClick={onPublicacionClick}
                />     
            ))}  
        </div>
    )
    return contenido; 
}