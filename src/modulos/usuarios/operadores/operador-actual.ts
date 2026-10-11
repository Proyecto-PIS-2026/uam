import { db } from "../../../infraestructura/persistencia/prisma/db";
import { ErrorAutorizacion, exigirOperador } from "@/modulos/identidad-acceso/autorizacion/controles";

export async function obtenerOperadorPorNombre(nombreFantasia: string) {
    if (!nombreFantasia.trim()) return null;

    return db.orm.public.Operador
        .select("id", "usuarioId", "nombreFantasia")
        .where({ nombreFantasia })
        .first();
}

export async function obtenerOperadorActual() {
    const sesion = await exigirOperador();
    const operador = await db.orm.public.Operador
        .select("id", "usuarioId", "nombreFantasia")
        .where({ usuarioId: sesion.usuarioId })
        .first();

    if (!operador) {
        throw new Error("No se encontró ningún operador de Mi Mercado.");
    }

    return operador;
}

export async function obtenerOperadorAutorizado(operadorId?: number) {
    const operador = await obtenerOperadorActual();
    if (operadorId !== undefined && operadorId !== operador.id) {
        throw new ErrorAutorizacion(403, "El operador no corresponde al usuario autenticado.");
    }
    return operador;
}