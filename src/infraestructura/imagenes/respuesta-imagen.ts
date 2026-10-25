import { puedeLeerImagen } from "./acceso-imagenes";
import { type CategoriaImagen, ErrorImagen, ErrorImagenNoEncontrada, tipoContenidoImagen, validarDestinoImagen } from "./almacenamiento-imagenes";
import { imagenes } from "./imagenes";

export async function responderImagen(categoria: string, idTexto: string, archivo: string): Promise<Response> {
    const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };
    const noEncontrada = () => new Response("Imagen no encontrada", { status: 404, headers });
    if (!/^[1-9]\d*$/.test(idTexto)) return noEncontrada();
    const id = Number(idTexto);
    const tipo = tipoContenidoImagen(archivo);
    if (!tipo) return noEncontrada();
    try {
        validarDestinoImagen(categoria, id);
        if (!await puedeLeerImagen(categoria as CategoriaImagen, id, archivo)) return noEncontrada();
        const contenido = await imagenes.leer(categoria as CategoriaImagen, id, archivo);
        return new Response(new Uint8Array(contenido), {
            headers: { ...headers, "Content-Type": tipo, "Content-Length": String(contenido.length) },
        });
    } catch (error) {
        if (error instanceof ErrorImagen || error instanceof ErrorImagenNoEncontrada) return noEncontrada();
        throw error;
    }
}
