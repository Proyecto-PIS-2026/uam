import { crearServicioImagenes, imagenes } from "@/infraestructura/imagenes/imagenes";
import { AlmacenamientoImagenesPostgres, type ClienteAlmacenamientoImagenes } from "@/infraestructura/imagenes/almacenamiento-postgres";

export { ErrorImagen as ErrorImagenPublicacion, tipoContenidoImagen } from "@/infraestructura/imagenes/almacenamiento-imagenes";

export async function guardarImagenPublicacion(publicacionId: number, archivo: File | string, cliente?: ClienteAlmacenamientoImagenes): Promise<string> {
    const servicio = cliente ? crearServicioImagenes(new AlmacenamientoImagenesPostgres(cliente)) : imagenes;
    return servicio.guardar("publicaciones", publicacionId, archivo);
}

export async function leerImagenPublicacion(publicacionId: number, nombreArchivo: string): Promise<Buffer> {
    return imagenes.leer("publicaciones", publicacionId, nombreArchivo);
}

export async function eliminarImagenPublicacionGestionada(url: string | null, publicacionId: number): Promise<void> {
    return imagenes.eliminar(url, "publicaciones", publicacionId);
}
