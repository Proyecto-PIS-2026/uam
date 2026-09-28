"use server";

import { revalidatePath } from "next/cache";
import { obtenerOperadorActual, obtenerOperadorPorId } from "../../usuarios/operadores/operador-actual";
import { actualizarPrecioPublicacion } from "./consultas-mi-mercado";

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

    revalidatePath("/mi-mercado");
    revalidatePath(`/mi-mercado/${operador.id}`);
    revalidatePath("/publicaciones");
    revalidatePath(`/operadores/${operador.id}`);
    revalidatePath("/operadores");
    revalidatePath("/inicio");
}
