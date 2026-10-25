import { validarCatalogosSeleccion } from "./seleccion-publicacion";
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
    const [productor, catalogosValidos] = await Promise.all([
        db.orm.public.Productor.where({ id: datos.productorId }).first(),
        validarCatalogosSeleccion(db, datos),
    ]);
    if (!productor || !catalogosValidos) {
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
            const ids = new Set(relaciones.filter((relacion) => relacion.paisId === datos.paisId).map((relacion) => relacion.publicacionId));
            const coincidencias = await tx.orm.public.Publicacion.where({
                especieId: datos.especieId,
                variedadId: datos.variedadId,
                presentacionId: datos.presentacionId,
                categoriaId: datos.categoriaId,
                calibreId: datos.calibreId,
                tipoPublicacion: "PRODUCTOR",
            }).select("id").all();
            if (coincidencias.some((publicacion) => ids.has(publicacion.id))) {
                return { esValido: false, errores: ["Este Productor ya tiene una publicación con la misma especie, variedad, presentación, categoría, calibre y país."] };
            }

            const publicacion = await tx.orm.public.Publicacion.create({
                ...(imagenCreada ? { id: imagenCreada.publicacionId } : {}),
                tipoPublicacion: "PRODUCTOR",
                publicacionDisponible: datos.disponibilidad,
                precio,
                foto: imagenCreada?.url ?? null,
                cantidadUnidades: datos.cantidadUnidades ?? null,
                especieId: datos.especieId,
                variedadId: datos.variedadId,
                presentacionId: datos.presentacionId,
                categoriaId: datos.categoriaId,
                calibreId: datos.calibreId,
            });
            const publicacionProductor = await tx.orm.public.PublicacionProductor.create({
                publicacionId: publicacion.id,
                productorId: productor.id,
                paisId: datos.paisId,
            });
            if (datos.latitud !== undefined && datos.latitud !== null && datos.longitud !== undefined && datos.longitud !== null) {
                await tx.orm.public.Ubicacion.create({
                    publicacionId: publicacionProductor.id,
                    nombreUbicacion: datos.nombreLugar?.trim() || datos.departamento!.trim(),
                    urlMaps: `https://www.google.com/maps?q=${encodeURIComponent(`${datos.latitud},${datos.longitud}`)}`,
                });
            }
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
