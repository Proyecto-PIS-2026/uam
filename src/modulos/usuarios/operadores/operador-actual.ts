import { db } from "../../../infraestructura/persistencia/prisma/db";

// TODO: reemplazar el operador temporal de Mi Mercado por el de la sesión.
const operadorIdTemporal = 9;

export async function obtenerOperadorActual() {
    const operador = await db.orm.public.Operador
        .select("id", "usuarioId", "nombreFantasia")
        .where({ id: operadorIdTemporal })
        .first();

    if (!operador) {
        throw new Error("No se encontró el operador de Mi Mercado.");
    }

    return operador;
}
