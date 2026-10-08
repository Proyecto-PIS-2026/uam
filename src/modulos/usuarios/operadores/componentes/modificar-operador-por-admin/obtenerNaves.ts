import { db } from "@/infraestructura/persistencia/prisma/db";

export type NaveOpcion = {
    id: number;
    nombre: string;
};

export async function obtenerNaves(): Promise<NaveOpcion[]> {
    const naves = await db.orm.public.Nave.all();

    return naves
        .map((nave) => ({
            id: nave.id,
            nombre: nave.nombreNave,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}