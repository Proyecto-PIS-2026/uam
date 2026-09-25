import { db } from "../../../infraestructura/persistencia/prisma/db";

export type PublicacionListado = {
    id: number;
    precio: number | null;
    foto: string | null;
    especie: string;
    variedad: string;
    presentacion: string;
    categoria: string;
    calibre: string;
    codigoCalibre: string;
    operador: {
        id: number;
        nombreFantasia: string;
        whatsApp: string;
    };
};

export type ResultadoPublicaciones = {
    publicaciones: PublicacionListado[];
};

export async function consultarPublicaciones(): Promise<ResultadoPublicaciones> {
    const consulta = db.sql.public.publicacionOperador
        .innerJoin(db.sql.public.publicacion, (tablas, operaciones) =>
            operaciones.eq(tablas.publicacionOperador.publicacionId, tablas.publicacion.id))
        .innerJoin(db.sql.public.presentacion, (tablas, operaciones) =>
            operaciones.eq(tablas.publicacion.presentacionId, tablas.presentacion.id))
        .innerJoin(db.sql.public.variedad, (tablas, operaciones) =>
            operaciones.eq(tablas.presentacion.variedadId, tablas.variedad.id))
        .innerJoin(db.sql.public.especie, (tablas, operaciones) =>
            operaciones.eq(tablas.variedad.especieId, tablas.especie.id))
        .innerJoin(db.sql.public.categoria, (tablas, operaciones) =>
            operaciones.eq(tablas.publicacion.categoriaId, tablas.categoria.id))
        .innerJoin(db.sql.public.calibre, (tablas, operaciones) =>
            operaciones.eq(tablas.publicacion.calibreId, tablas.calibre.id))
        .innerJoin(db.sql.public.operador, (tablas, operaciones) =>
            operaciones.eq(tablas.publicacionOperador.operadorId, tablas.operador.id))
        .select((tablas) => ({
            id: tablas.publicacion.id,
            precio: tablas.publicacion.precio,
            foto: tablas.publicacion.foto,
            especie: tablas.especie.nombreEspecie,
            variedad: tablas.variedad.nombreVariedad,
            presentacion: tablas.presentacion.nombrePresentacion,
            categoria: tablas.categoria.nombreCategoria,
            calibre: tablas.calibre.nombreCalibre,
            codigoCalibre: tablas.calibre.codigoCalibre,           
            operadorId: tablas.operador.id,
            operadorNombreFantasia: tablas.operador.nombreFantasia,
            operadorWhatsApp: tablas.operador.whatsApp,
        }))
        .where((tablas, operaciones) =>
            operaciones.and(
                operaciones.eq(tablas.publicacion.publicacionActiva, true),
                operaciones.eq(tablas.publicacion.publicacionDisponible, true)
            )
        );
    
    const plan = consulta.build();
    const filas = await db.runtime().query(plan);
    const publicaciones: PublicacionListado[] = filas.map((fila) => ({
        id: Number(fila.id),
        precio: Number(fila.precio),
        foto: fila.foto,
        especie: fila.especie,
        variedad: fila.variedad,
        presentacion: fila.presentacion,
        categoria: fila.categoria,
        calibre: fila.calibre,
        codigoCalibre: fila.codigoCalibre,
        operador: {
            id: Number(fila.operadorId),
            nombreFantasia: fila.operadorNombreFantasia,
            whatsApp: fila.operadorWhatsApp
        }
    }));

    return { publicaciones };
}