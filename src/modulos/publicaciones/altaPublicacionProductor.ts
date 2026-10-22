import { db } from "../../infraestructura/persistencia/prisma/db";
import { eliminarImagenProductor, ErrorImagenProductor, guardarImagenProductor } from "./imagenes-productor";
import { validarAltaPublicacionProductor } from "./validarAltaPublicacionProductor";

export type ResultadoAltaPublicacionProductor =
    | { esValido: false; errores: string[] }
    | { esValido: true; id: number; mensaje: string };

export async function altaPublicacionProductor(valor: unknown): Promise<ResultadoAltaPublicacionProductor> {
    const validacion = validarAltaPublicacionProductor(valor);
    if (!validacion.esValido) return validacion;
    const datos = validacion.datos;
    const [productor, especie, variedad, presentacion, categoria, calibre, pais] = await Promise.all([
        db.orm.public.Productor.where({ id: datos.productorId }).first(),
        db.orm.public.Especie.where({ id: datos.especieId }).first(),
        db.orm.public.Variedad.where({ id: datos.variedadId }).first(),
        db.orm.public.Presentacion.where({ id: datos.presentacionId }).first(),
        db.orm.public.Categoria.where({ id: datos.categoriaId }).first(),
        db.orm.public.Calibre.where({ id: datos.calibreId }).first(),
        db.orm.public.Pais.where({ id: datos.paisId }).first(),
    ]);
    if (!productor || !especie?.especieActiva || !variedad?.variedadActiva || !presentacion?.presentacionActiva || !categoria || !calibre || !pais ||
        variedad.especieId !== especie.id || presentacion.variedadId !== variedad.id ||
        (categoria.especieId !== null && categoria.especieId !== especie.id)) {
        return { esValido: false, errores: ["La selección contiene datos que ya no están disponibles. Actualizá el formulario."] };
    }

    type Precio = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];
    const precio = (datos.precio?.trim().replace(",", ".") || null) as Precio;
    let id: number;
    try {
        id = await db.transaction(async (tx) => {
            await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1720, ${productor.id})`
                .returnsRow({ locked: "pg/int4@1" }).build());
            const relaciones = await tx.orm.public.PublicacionProductor.where({ productorId: productor.id }).all();
            const ids = new Set(relaciones.map((relacion) => relacion.publicacionId));
            const coincidencias = await tx.orm.public.Publicacion.where({
                presentacionId: presentacion.id,
                categoriaId: categoria.id,
                calibreId: calibre.id,
                tipoPublicacion: "PRODUCTOR",
            }).select("id").all();
            if (coincidencias.some((publicacion) => ids.has(publicacion.id))) throw new Error("DUPLICADO");

            const publicacion = await tx.orm.public.Publicacion.create({
                tipoPublicacion: "PRODUCTOR",
                publicacionDisponible: datos.disponibilidad,
                precio,
                foto: null,
                cantidadUnidades: datos.cantidadUnidades ?? null,
                presentacionId: presentacion.id,
                categoriaId: categoria.id,
                calibreId: calibre.id,
            });
            const publicacionProductor = await tx.orm.public.PublicacionProductor.create({
                publicacionId: publicacion.id,
                productorId: productor.id,
                paisId: pais.id,
            });
            await tx.orm.public.Ubicacion.create({
                publicacionId: publicacionProductor.id,
                nombreUbicacion: datos.nombreLugar?.trim() || datos.departamento.trim(),
                urlMaps: `https://www.google.com/maps?q=${encodeURIComponent(`${datos.latitud},${datos.longitud}`)}`,
            });
            return publicacion.id;
        });
    } catch (error) {
        if (error instanceof Error && error.message === "DUPLICADO") {
            return { esValido: false, errores: ["Este Productor ya tiene una publicación con la misma especie, variedad, presentación, categoría y calibre."] };
        }
        throw error;
    }

    if (datos.fotografia) {
        let foto: string | null = null;
        try {
            foto = await guardarImagenProductor(id, datos.fotografia);
            await db.orm.public.Publicacion.where({ id }).update({ foto });
        } catch (error) {
            await db.orm.public.Publicacion.where({ id }).delete();
            await eliminarImagenProductor(foto);
            if (error instanceof ErrorImagenProductor) return { esValido: false, errores: [error.message] };
            throw error;
        }
    }
    return { esValido: true, id, mensaje: "Publicación creada correctamente." };
}
