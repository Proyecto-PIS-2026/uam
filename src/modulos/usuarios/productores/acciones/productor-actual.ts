import { db } from "../../../../infraestructura/persistencia/prisma/db";
import { exigirProductor } from "@/modulos/identidad-acceso/autorizacion/controles";

export async function obtenerProductorActual() {
    const sesion = await exigirProductor();
    const productor = await db.orm.public.Productor
        .select("id", "usuarioId", "nombreFantasia")
        .where({ usuarioId: sesion.usuarioId })
        .first();

    if (!productor) {
        throw new Error("No se encontró ningún productor de Mi Mercado.");
    }

    return productor;
}
