"use server";

import { revalidatePath } from "next/cache";
import { obtenerOperadorActual } from "../../usuarios/operadores/operador-actual";
import { actualizarPrecioPublicacion } from "./consultas-mi-mercado";

export async function actualizarPrecio(publicacionId: number, nuevoPrecio: number) {
    const operador = await obtenerOperadorActual();
    await actualizarPrecioPublicacion(operador.id, publicacionId, nuevoPrecio);

    revalidatePath("/mi-mercado");
    revalidatePath("/publicaciones");
    revalidatePath(`/operadores/${operador.id}`);
    revalidatePath("/operadores");
    revalidatePath("/inicio");
}
