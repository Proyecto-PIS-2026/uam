import { db } from "@/infraestructura/persistencia/prisma/db";
import { eliminarImagenEspecieGestionada } from "./imagenes-especies";

export async function limpiarImagenEspecieNoReferenciada(url: string, especieId: number ): Promise<void> {
    try {
        const especie = await db.orm.public.Especie
            .select("fotoEspecie")
            .where({ id: especieId })
            .first();
        if (especie?.fotoEspecie !== url) {
            await eliminarImagenEspecieGestionada(url, especieId);
        }
    } catch (error) {
        console.error("No se pudo confirmar la limpieza de una imagen de especie.", error);
    }
}