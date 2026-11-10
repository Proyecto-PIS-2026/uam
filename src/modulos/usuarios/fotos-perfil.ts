import { ErrorImagen } from "@/infraestructura/imagenes/almacenamiento-imagenes";
import { AlmacenamientoImagenesPostgres, type ClienteAlmacenamientoImagenes } from "@/infraestructura/imagenes/almacenamiento-postgres";
import { crearServicioImagenes, TAMANO_MAXIMO_IMAGEN } from "@/infraestructura/imagenes/imagenes";

type CambioFotoPerfil =
    | { accion: "conservar" }
    | { accion: "eliminar" }
    | { accion: "reemplazar"; archivo: File };

type ResultadoValidacionFotoPerfil =
    | { esValido: true; cambio: CambioFotoPerfil }
    | { esValido: false; errores: string[] };

export function validarCambioFotoPerfil(entrada: unknown, permitirEliminar = true): ResultadoValidacionFotoPerfil {
    const invalida = (mensaje: string): ResultadoValidacionFotoPerfil => ({ esValido: false, errores: [mensaje] });
    if (entrada === undefined) return { esValido: true, cambio: { accion: "conservar" } };
    if (!(entrada instanceof FormData)) return invalida("Los datos de la foto de perfil no son válidos.");
    if ([...entrada.keys()].some((clave) => clave !== "fotoPerfil" && clave !== "eliminarFoto") || entrada.getAll("fotoPerfil").length > 1 || entrada.getAll("eliminarFoto").length > 1) {
        return invalida("Los datos de la foto de perfil no son válidos.");
    }
    const archivo = entrada.get("fotoPerfil");
    const eliminar = entrada.get("eliminarFoto");
    if (eliminar !== null && eliminar !== "true") return invalida("La opción de eliminar foto no es válida.");
    if (eliminar === "true") {
        if (!permitirEliminar) return invalida("No se puede eliminar una foto al registrar el usuario.");
        if (archivo !== null) return invalida("No se puede cargar y eliminar una foto al mismo tiempo.");
        return { esValido: true, cambio: { accion: "eliminar" } };
    }
    if (archivo === null) return { esValido: true, cambio: { accion: "conservar" } };
    if (typeof archivo === "string" || typeof archivo.arrayBuffer !== "function") return invalida("Seleccioná un archivo de imagen válido.");
    if (archivo.size <= 0 || archivo.size > TAMANO_MAXIMO_IMAGEN) return invalida("La imagen debe pesar entre 1 byte y 10 MB.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) return invalida("La imagen debe ser JPEG, PNG o WebP.");
    return { esValido: true, cambio: { accion: "reemplazar", archivo } };
}

export async function guardarCambioFotoPerfil(
    cliente: ClienteAlmacenamientoImagenes,
    categoria: "operadores" | "productores",
    id: number,
    fotoActual: string | null,
    cambio: CambioFotoPerfil,
): Promise<string | null | undefined> {
    if (cambio.accion === "conservar") return undefined;
    const imagenes = crearServicioImagenes(new AlmacenamientoImagenesPostgres(cliente));
    const fotoNueva = cambio.accion === "reemplazar" ? await imagenes.guardar(categoria, id, cambio.archivo) : null;
    await imagenes.eliminar(fotoActual, categoria, id);
    return fotoNueva;
}

export async function controlarErrorFotoPerfil(guardar: () => Promise<number | string>): Promise<number | string> {
    try {
        return await guardar();
    } catch (error) {
        if (error instanceof ErrorImagen) return error.message;
        throw error;
    }
}
