import { normalizarSeleccionPublicacion, validarCatalogosSeleccion } from "../seleccion-publicacion";
import { limpiarImagenPublicacionNoReferenciada } from "./limpiar-imagen-publicacion";
import { notificarCambioPublicacion } from "@/infraestructura/tiempo-real/publicaciones";
import { db } from "../../../infraestructura/persistencia/prisma/db";
import { eliminarImagenPublicacionGestionada, ErrorImagenPublicacion, guardarImagenPublicacion } from "./imagenes-publicacion";
import type { CambiosPublicacionOperador } from "./tipos";
import { normalizarPrecioPublicacion, precioPublicacionValido, PRECIO_PUBLICACION_INVALIDO } from "../precio-publicacion";

type PrecioDb = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];
type CantidadUnidadesDb = Parameters<typeof db.orm.public.Publicacion.create>[0]["cantidadUnidades"];

export class ErrorEdicionPublicacion extends Error {
    constructor(
        public readonly codigo: "DATOS_INVALIDOS" | "NO_ENCONTRADA" | "CONFLICTO",
        mensaje: string
    ) {
        super(mensaje);
        this.name = "ErrorEdicionPublicacion";
    }
}

export async function modificarPublicacionOperador(
    usuarioIdAutenticado: number,
    publicacionOperadorId: number,
    cambios: CambiosPublicacionOperador,
    fotoNueva?: File | null
): Promise<{ publicacionOperadorId: number; publicacionId: number }> {

    if (cambios === null || typeof cambios !== "object" || Array.isArray(cambios)) {
        throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "Los cambios no son válidos.");
    }

    if (typeof cambios.disponible !== "boolean") {
        throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "La disponibilidad no es válida.");
    }

    const seleccion = normalizarSeleccionPublicacion(cambios);
    if (!seleccion.esValido) {
        throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", seleccion.errores.join(" "));
    }
    cambios = { ...cambios, ...seleccion.seleccion };

    if (cambios.precio !== null && typeof cambios.precio !== "string") {
        throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "El precio no es válido.");
    }
    if (!precioPublicacionValido(cambios.precio)) {
        throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", PRECIO_PUBLICACION_INVALIDO);
    }
    const precioParaGuardar = normalizarPrecioPublicacion(cambios.precio) as PrecioDb;

    let cantidadUnidadesParaGuardar: CantidadUnidadesDb | undefined = undefined;

    if (cambios.cantidadUnidades !== undefined) {
        if (cambios.cantidadUnidades !== null) {
            if (typeof cambios.cantidadUnidades !== "number") {
                throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "La cantidad de unidades debe ser un número.");
            }
            if (!Number.isSafeInteger(cambios.cantidadUnidades)) {
                throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "La cantidad de unidades debe ser un número entero válido.");
            }
            if (cambios.cantidadUnidades < 0 || cambios.cantidadUnidades > 2147483647) {
                throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "La cantidad de unidades debe ser un número entero entre 0 y 2147483647.");
            }
            cantidadUnidadesParaGuardar = cambios.cantidadUnidades as CantidadUnidadesDb;
        } else {
            cantidadUnidadesParaGuardar = null;
        }
    }

    let imagenCreada: { url: string; publicacionId: number } | undefined;
    if (fotoNueva) {
        const operador = await db.orm.public.Operador.select("id").where({ usuarioId: usuarioIdAutenticado }).first();
        if (!operador) throw new ErrorEdicionPublicacion("NO_ENCONTRADA", "Operador no encontrado.");
        const vinculo = await db.orm.public.PublicacionOperador.select("publicacionId")
            .where({ id: publicacionOperadorId, operadorId: operador.id }).first();
        if (!vinculo) throw new ErrorEdicionPublicacion("NO_ENCONTRADA", "Publicación no encontrada para este operador.");
        const actual = await db.orm.public.Publicacion.select("tipoPublicacion", "version").where({ id: vinculo.publicacionId }).first();
        if (!actual || actual.tipoPublicacion !== "OPERADOR") throw new ErrorEdicionPublicacion("NO_ENCONTRADA", "Publicación no encontrada.");
        if (!Number.isSafeInteger(cambios.version) || cambios.version !== actual.version) {
            throw new ErrorEdicionPublicacion("CONFLICTO", "La publicación cambió en otra sesión. Cancelá la edición y revisá los datos actualizados antes de volver a guardar.");
        }
        try {
            const url = await guardarImagenPublicacion(vinculo.publicacionId, fotoNueva);
            imagenCreada = { url, publicacionId: vinculo.publicacionId };
        } catch (error) {
            if (error instanceof ErrorImagenPublicacion) throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", error.message);
            throw error;
        }
    }
    const resultado = await db.transaction(async (tx) => {
            const operador = await tx.orm.public.Operador
                .select("id")
                .where({ usuarioId: usuarioIdAutenticado })
                .first();

            if (!operador) {
                throw new ErrorEdicionPublicacion("NO_ENCONTRADA", "Operador no encontrado.");
            }

            // Compartir el bloqueo del alta evita que dos cambios simultáneos creen duplicados.
            await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ${operador.id})`
                .returnsRow({ locked: "pg/int4@1" }).build());

            const vinculo = await tx.orm.public.PublicacionOperador
                .select("id", "publicacionId")
                .where({
                    id: publicacionOperadorId,
                    operadorId: operador.id
                })
                .first();

            if (!vinculo) {
                throw new ErrorEdicionPublicacion("NO_ENCONTRADA", "Publicación no encontrada para este operador.");
            }
            if (imagenCreada && imagenCreada.publicacionId !== vinculo.publicacionId) {
                throw new ErrorEdicionPublicacion("NO_ENCONTRADA", "La publicación cambió mientras se preparaba la imagen.");
            }

            const publicacion = await tx.orm.public.Publicacion
                .select("tipoPublicacion", "foto", "version")
                .where({ id: vinculo.publicacionId })
                .first();

            if (!publicacion || publicacion.tipoPublicacion !== "OPERADOR") {
                throw new ErrorEdicionPublicacion("NO_ENCONTRADA", "Publicación no encontrada.");
            }

            if (!Number.isSafeInteger(cambios.version) || cambios.version !== publicacion.version) {
                throw new ErrorEdicionPublicacion("CONFLICTO", "La publicación cambió en otra sesión. Cancelá la edición y revisá los datos actualizados antes de volver a guardar.");
            }

            if (!await validarCatalogosSeleccion(tx, cambios)) {
                throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "La selección contiene datos que ya no están disponibles o no corresponden a la especie.");
            }

            const relaciones = await tx.orm.public.PublicacionOperador.where({ operadorId: operador.id }).all();
            const idsDeOtrasPublicaciones = new Set(
                relaciones.filter((relacion) => relacion.publicacionId !== vinculo.publicacionId && relacion.paisId === cambios.paisId)
                    .map((relacion) => relacion.publicacionId),
            );
            if (idsDeOtrasPublicaciones.size > 0) {
                const coincidencias = await tx.orm.public.Publicacion.where({
                    especieId: cambios.especieId,
                    variedadId: cambios.variedadId,
                    presentacionId: cambios.presentacionId,
                    categoriaId: cambios.categoriaId,
                    calibreId: cambios.calibreId,
                }).select("id").all();
                if (coincidencias.some((coincidencia) => idsDeOtrasPublicaciones.has(coincidencia.id))) {
                    throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "Este operador ya tiene una publicación con la misma especie, variedad, presentación, categoría, calibre y país.");
                }
            }

            // Una edición abierta antes de otro cambio no debe restaurar una URL vieja.
            // Sólo null solicita borrar la foto; el archivo nuevo la reemplaza.
            const fotoActual = imagenCreada?.url ?? (cambios.foto === null ? null : publicacion.foto);

            const actualizada = await tx.orm.public.Publicacion
                .where({ id: vinculo.publicacionId, version: cambios.version })
                .update({
                    version: cambios.version + 1,
                    precio: precioParaGuardar,
                    cantidadUnidades: cantidadUnidadesParaGuardar,
                    foto: fotoActual,
                    especieId: cambios.especieId,
                    variedadId: cambios.variedadId,
                    categoriaId: cambios.categoriaId,
                    calibreId: cambios.calibreId,
                    presentacionId: cambios.presentacionId,
                    publicacionDisponible: cambios.disponible,
                });

            if (!actualizada) {
                throw new ErrorEdicionPublicacion("CONFLICTO", "La publicación cambió mientras se guardaban los datos. Volvé a consultar la publicación.");
            }

            await tx.orm.public.PublicacionOperador
                .where({ id: vinculo.id })
                .update({ paisId: cambios.paisId });

            await notificarCambioPublicacion(tx, { operadorId: operador.id, publicacionId: vinculo.publicacionId });

            return {
                publicacionOperadorId: vinculo.id,
                publicacionId: vinculo.publicacionId,
                fotoAnterior: publicacion.foto,
                fotoActual
            };
        }).catch(async (error: unknown) => {
            if (imagenCreada) {
                try {
                    await limpiarImagenPublicacionNoReferenciada(imagenCreada.url, imagenCreada.publicacionId);
                } catch (errorLimpieza) {
                    console.error("No se pudo eliminar la imagen de una edición fallida", errorLimpieza);
                }
            }
            throw error;
        });

    if (resultado.fotoAnterior !== resultado.fotoActual) {
        try {
            await eliminarImagenPublicacionGestionada(resultado.fotoAnterior, resultado.publicacionId);
        } catch (error) {
            console.error("No se pudo eliminar la imagen anterior:", error);
        }
    }

    return { publicacionOperadorId: resultado.publicacionOperadorId, publicacionId: resultado.publicacionId };
}
