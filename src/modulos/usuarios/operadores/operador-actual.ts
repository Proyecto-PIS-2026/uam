import { db } from "../../../infraestructura/persistencia/prisma/db";

// TODO: reemplazar la selección predeterminada por el operador de la sesión.

export async function obtenerOperadorPorId(operadorId: number) {
    if (!Number.isSafeInteger(operadorId) || operadorId <= 0) return null;

    return db.orm.public.Operador
        .select("id", "usuarioId", "nombreFantasia")
        .where({ id: operadorId })
        .first();
}

export async function obtenerOperadorActual() {
    const operador = await db.orm.public.Operador
        .select("id", "usuarioId", "nombreFantasia")
        .orderBy((operador) => operador.id.asc())
        .first();

    if (!operador) {
        throw new Error("No se encontró ningún operador de Mi Mercado.");
    }

    return operador;
}
