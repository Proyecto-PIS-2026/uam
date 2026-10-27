import { imagenes } from "@/infraestructura/imagenes/imagenes";

export { ErrorImagen as ErrorImagenProductor } from "@/infraestructura/imagenes/almacenamiento-imagenes";

export async function guardarImagenProductor(publicacionId: number, fotografia: string): Promise<string> {
    return imagenes.guardar("publicaciones", publicacionId, fotografia);
}

export async function eliminarImagenProductor(url: string | null, publicacionId: number): Promise<void> {
    return imagenes.eliminar(url, "publicaciones", publicacionId);
}
