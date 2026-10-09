import { db } from "../../../infraestructura/persistencia/prisma/db";
import { obtenerSesion } from "../../identidad-acceso/autenticacion/sesiones";

export async function obtenerOperadorPorId(operadorId: number) {
    if (!Number.isSafeInteger(operadorId) || operadorId <= 0) return null;

    return db.orm.public.Operador
        .select("id", "usuarioId", "nombreFantasia")
        .where({ id: operadorId })
        .first();
}

export async function obtenerOperadorPorNombre(nombreFantasia: string) {
    if (!nombreFantasia.trim()) return null;

    return db.orm.public.Operador
        .select("id", "usuarioId", "nombreFantasia")
        .where({ nombreFantasia })
        .first();
}

export async function obtenerOperadorActual() {
    const sesion = await obtenerSesion();
    if (!sesion) throw new Error("Debe iniciar sesión.");

    const operador = await db.orm.public.Operador
        .select("id", "usuarioId", "nombreFantasia")
        .where({ usuarioId: sesion.usuarioId })
        .first();

    if (!operador) {
        throw new Error("No se encontró ningún operador de Mi Mercado.");
    }

    return operador;
}
