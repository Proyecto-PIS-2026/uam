"use server";

import { db } from "@/infraestructura/persistencia/prisma/db";
import {
    modificarPublicacionOperador,
    type CambiosPublicacionOperador,
} from "@/modulos/publicaciones/operadores/modificar-publicacion";

/**
 * Adaptador temporal para desarrollo local sin autenticación.
 * En producción, sustituir la resolución del usuario por la sesión autenticada.
 */
export async function guardarEdicionPublicacion(
    publicacionOperadorId: number,
    cambios: CambiosPublicacionOperador
) {
    if (process.env.NODE_ENV !== "development") {
        throw new Error("La edición requiere integrar la autenticación del operador.");
    }

    const vinculo = await db.orm.public.PublicacionOperador
        .select("id")
        .include("operador", (operador) => operador.select("usuarioId"))
        .where({ id: publicacionOperadorId })
        .first();

    if (!vinculo) {
        throw new Error("No se encontró la publicación del operador.");
    }

    return modificarPublicacionOperador(
        vinculo.operador.usuarioId,
        publicacionOperadorId,
        cambios
    );
}
