import { imagenes } from "@/infraestructura/imagenes/imagenes";

export {
    ErrorImagen as ErrorImagenEspecie,
} from "@/infraestructura/imagenes/almacenamiento-imagenes";

export async function guardarImagenEspecie(especieId: number, archivo: File): Promise<string> {
    return imagenes.guardar("especies", especieId, archivo);
}

export async function eliminarImagenEspecieGestionada(url: string | null, especieId: number): Promise<void> {
    return imagenes.eliminar(url, "especies", especieId);
}