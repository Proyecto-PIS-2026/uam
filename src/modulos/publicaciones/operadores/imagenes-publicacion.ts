import { imagenes } from "@/infraestructura/imagenes/imagenes";

export { ErrorImagen as ErrorImagenPublicacion, tipoContenidoImagen } from "@/infraestructura/imagenes/almacenamiento-imagenes";

export async function guardarImagenPublicacion(publicacionId: number, archivo: File | string): Promise<string> {
    return imagenes.guardar("publicaciones", publicacionId, archivo);
}

export async function leerImagenPublicacion(publicacionId: number, nombreArchivo: string): Promise<Buffer> {
    return imagenes.leer("publicaciones", publicacionId, nombreArchivo);
}

export async function eliminarImagenPublicacionGestionada(url: string | null, publicacionId: number): Promise<void> {
    return imagenes.eliminar(url, "publicaciones", publicacionId);
}
