import { db } from "../../infraestructura/persistencia/prisma/db";

const runtime = db.runtime();

export default async function obtenerEspecies() {
    const especie = db.sql.public.especie;
    const plan = db.raw.sql`
        SELECT
            e.id,
            e."nombreEspecie",
            e."fotoEspecie"
        FROM public.especie e
        ORDER BY e."nombreEspecie"
    `
        .returnsRow({
            id: especie.columns.id,
            nombreEspecie: especie.columns.nombreEspecie,
            fotoEspecie: especie.columns.fotoEspecie,
        })
        .build();

    const especies = await runtime.query(plan);

    return especies.map((especie) => ({
        id: especie.id,
        nombreEspecie: especie.nombreEspecie,
        fotoEspecie: especie.fotoEspecie,
    }));
}