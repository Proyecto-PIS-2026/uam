import { db } from "../../infraestructura/persistencia/prisma/db";
import { ErrorImagenProductor, guardarImagenProductor } from "./imagenes-productor";
import { limpiarImagenPublicacionNoReferenciada } from "./operadores/limpiar-imagen-publicacion";
import { validarAltaPublicacionProductor } from "./validarAltaPublicacionProductor";
import { normalizarPrecioPublicacion } from "./precio-publicacion";

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
    const precio = normalizarPrecioPublicacion(datos.precio) as Precio;
    let imagenCreada: { url: string; publicacionId: number } | undefined;
    let resultado: ResultadoAltaPublicacionProductor;
    try {
        if (datos.fotografia) {
            const plan = db.raw.sql`SELECT nextval(pg_get_serial_sequence('publicacion', 'id'))::int AS id`
                .returnsRow({ id: "pg/int4@1" }).build();
            const [identificador] = await db.runtime().query(plan);
            if (!identificador) throw new Error("No se pudo reservar el identificador de la publicación.");
            const url = await guardarImagenProductor(identificador.id, datos.fotografia);
            imagenCreada = { url, publicacionId: identificador.id };
        }
        resultado = await db.transaction(async (tx): Promise<ResultadoAltaPublicacionProductor> => {
            await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1720, ${productor.id})`
                .returnsRow({ locked: "pg/int4@1" }).build());
            const productorActual = await tx.orm.public.Productor.where({ id: productor.id }).first();
            if (!productorActual) {
                return { esValido: false, errores: ["El Productor ya no existe. No se pudo guardar la publicación."] };
            }
            const relaciones = await tx.orm.public.PublicacionProductor.where({ productorId: productor.id }).all();
            const ids = new Set(relaciones.map((relacion) => relacion.publicacionId));
            const coincidencias = await tx.orm.public.Publicacion.where({
                presentacionId: presentacion.id,
                categoriaId: categoria.id,
                calibreId: calibre.id,
                tipoPublicacion: "PRODUCTOR",
            }).select("id").all();
            if (coincidencias.some((publicacion) => ids.has(publicacion.id))) {
                return { esValido: false, errores: ["Este Productor ya tiene una publicación con la misma especie, variedad, presentación, categoría y calibre."] };
            }

            const publicacion = await tx.orm.public.Publicacion.create({
                ...(imagenCreada ? { id: imagenCreada.publicacionId } : {}),
                tipoPublicacion: "PRODUCTOR",
                publicacionDisponible: datos.disponibilidad,
                precio,
                foto: imagenCreada?.url ?? null,
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
            return { esValido: true, id: publicacion.id, mensaje: "Publicación creada correctamente." };
        });
    } catch (error) {
        if (imagenCreada) {
            await limpiarImagenPublicacionNoReferenciada(imagenCreada.url, imagenCreada.publicacionId);
        }
        if (error instanceof ErrorImagenProductor) return { esValido: false, errores: [error.message] };
        throw error;
    }

    if (!resultado.esValido && imagenCreada) {
        await limpiarImagenPublicacionNoReferenciada(imagenCreada.url, imagenCreada.publicacionId);
    }
    return resultado;
}
