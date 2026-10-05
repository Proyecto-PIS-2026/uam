"use server";

import { revalidatePath } from "next/cache";
import { obtenerOperadorActual, obtenerOperadorPorId } from "../../usuarios/operadores/operador-actual";
import { actualizarPrecioPublicacion, obtenerPublicacionesDeOperador } from "./consultas-mi-mercado";
import { mapearPublicacionesMiMercado } from "./mapear-publicaciones";

export async function cargarPublicacionesMiMercado(operadorId: number) {
    const operador = await obtenerOperadorPorId(operadorId);
    if (!operador) throw new Error("No se encontró el operador de Mi Mercado.");

    const relaciones = await obtenerPublicacionesDeOperador(operador.id);
    return mapearPublicacionesMiMercado(relaciones);
}

export async function actualizarPrecio(publicacionId: number, nuevoPrecio: number, operadorId?: number) {
    if (operadorId !== undefined && (!Number.isSafeInteger(operadorId) || operadorId <= 0)) {
        throw new Error("El ID del operador debe ser un número entero positivo.");
    }

    const operador = operadorId === undefined
        ? await obtenerOperadorActual()
        : await obtenerOperadorPorId(operadorId);

    if (!operador) {
        throw new Error("No se encontró el operador de Mi Mercado.");
    }

    await actualizarPrecioPublicacion(operador.id, publicacionId, nuevoPrecio);

    /*
     * DEMO: Mi Mercado actualiza su listado con cargarPublicacionesMiMercado.
     * Para recuperar la revalidación automática de esa vista, volver a incluir
     * "/mi-mercado" y la ruta con el nombre del operador en este arreglo.
     */
    const rutas = [
        "/publicaciones",
        `/operadores/${encodeURIComponent(operador.nombreFantasia)}`,
        "/operadores",
        "/inicio",
    ];

    for (const ruta of rutas) {
        try {
            revalidatePath(ruta);
        } catch (error) {
            // El precio ya se guardó. El cliente recarga Mi Mercado directamente.
            console.error(`No se pudo revalidar ${ruta} tras guardar el precio:`, error);
        }
    }
}
