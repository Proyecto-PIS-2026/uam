import { db } from "../../../infraestructura/persistencia/prisma/db";
import { eliminarImagenPublicacionGestionada, ErrorImagenPublicacion, guardarImagenPublicacion } from "./imagenes-publicacion";

type PrecioDb = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];
type CantidadUnidadesDb = Parameters<typeof db.orm.public.Publicacion.create>[0]["cantidadUnidades"];

export type CambiosPublicacionOperador = {
    precio: string | null;
    cantidadUnidades?: number | null;
    foto?: string | null;
    categoriaId: number;
    calibreId: number;
    presentacionId: number;
    paisId: number;
    disponible: boolean;
};

export class ErrorEdicionPublicacion extends Error {
    constructor(
        public readonly codigo: "DATOS_INVALIDOS" | "NO_ENCONTRADA",
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

    if (typeof cambios.paisId !== "number" || !Number.isSafeInteger(cambios.paisId) || cambios.paisId <= 0) {
        throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "El país no es válido.");
    }

    let precioParaGuardar: PrecioDb = null;

    if (cambios.precio !== null) {
        if (typeof cambios.precio !== "string") {
            throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "El precio no es válido.");
        }
        const precio = cambios.precio.trim();
        const formatoValido = /^(0|[1-9]\d{0,9})$/.test(precio);
        if (!formatoValido) {
            throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "El precio debe ser un número entero de hasta 10 dígitos, sin decimales.");
        }
        precioParaGuardar = precio as PrecioDb;
    }

    let cantidadUnidadesParaGuardar: CantidadUnidadesDb | undefined = undefined;

    if (cambios.cantidadUnidades !== undefined) {
        if (cambios.cantidadUnidades !== null) {
            if (typeof cambios.cantidadUnidades !== "number") {
                throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "La cantidad de unidades debe ser un número.");
            }
            if (!Number.isSafeInteger(cambios.cantidadUnidades)) {
                throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "La cantidad de unidades debe ser un número entero válido.");
            }
            if (cambios.cantidadUnidades < 0 || cambios.cantidadUnidades > 9999999999) {
                throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "La cantidad de unidades debe ser un número positivo de hasta 10 dígitos.");
            }
            cantidadUnidadesParaGuardar = cambios.cantidadUnidades as CantidadUnidadesDb;
        } else {
            cantidadUnidadesParaGuardar = null;
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

            const publicacion = await tx.orm.public.Publicacion
                .select("tipoPublicacion", "foto")
                .where({ id: vinculo.publicacionId })
                .first();

            if (!publicacion || publicacion.tipoPublicacion !== "OPERADOR") {
                throw new ErrorEdicionPublicacion("NO_ENCONTRADA", "Publicación no encontrada.");
            }

            const presentacion = await tx.orm.public.Presentacion
                .select("id", "presentacionActiva")
                .include("variedad", (variedad) =>
                    variedad
                        .select("especieId", "variedadActiva")
                        .include("especie", (especie) =>
                            especie.select("especieActiva"),
                        ),
                )
                .where({ id: cambios.presentacionId })
                .first();

            if (!presentacion) {
                throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "La presentación no existe.");
            }

            if (!presentacion.presentacionActiva || !presentacion.variedad.variedadActiva || !presentacion.variedad.especie.especieActiva) {
                throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "La presentación seleccionada no está activa.");
            }

            const categoria = await tx.orm.public.Categoria
                .select("id", "especieId")
                .where({ id: cambios.categoriaId })
                .first();

            if (!categoria) {
                throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "La categoría no existe.");
            }

            if (categoria.especieId !== null && categoria.especieId !== presentacion.variedad.especieId) {
                throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "La categoría no corresponde a la especie de la presentación.");
            }

            const calibre = await tx.orm.public.Calibre
                .select("id")
                .where({ id: cambios.calibreId })
                .first();

            if (!calibre) {
                throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "El calibre no existe.");
            }

            const pais = await tx.orm.public.Pais
                .select("id")
                .where({ id: cambios.paisId })
                .first();

            if (!pais) {
                throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "El país no existe.");
            }

            const relaciones = await tx.orm.public.PublicacionOperador.where({ operadorId: operador.id }).all();
            const idsDeOtrasPublicaciones = new Set(
                relaciones.filter((relacion) => relacion.publicacionId !== vinculo.publicacionId)
                    .map((relacion) => relacion.publicacionId),
            );
            if (idsDeOtrasPublicaciones.size > 0) {
                const coincidencias = await tx.orm.public.Publicacion.where({
                    presentacionId: cambios.presentacionId,
                    categoriaId: cambios.categoriaId,
                    calibreId: cambios.calibreId,
                }).select("id").all();
                if (coincidencias.some((coincidencia) => idsDeOtrasPublicaciones.has(coincidencia.id))) {
                    throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "Este operador ya tiene una publicación con la misma especie, variedad, presentación, categoría y calibre.");
                }
            }

            let imagenNueva: string | null = null;
            if (fotoNueva) {
                try {
                    imagenNueva = await guardarImagenPublicacion(vinculo.publicacionId, fotoNueva);
                } catch (error) {
                    if (error instanceof ErrorImagenPublicacion) {
                        throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", error.message);
                    }
                    throw error;
                }
            }

            // Una edición abierta antes de otro cambio no debe restaurar una URL vieja.
            // Sólo null solicita borrar la foto; el archivo nuevo la reemplaza.
            const fotoActual = imagenNueva ?? (cambios.foto === null ? null : publicacion.foto);

            await tx.orm.public.Publicacion
                .where({ id: vinculo.publicacionId })
                .update({
                    precio: precioParaGuardar,
                    cantidadUnidades: cantidadUnidadesParaGuardar,
                    foto: fotoActual,
                    categoriaId: cambios.categoriaId,
                    calibreId: cambios.calibreId,
                    presentacionId: cambios.presentacionId,
                    publicacionDisponible: cambios.disponible,
                });

            await tx.orm.public.PublicacionOperador
                .where({ id: vinculo.id })
                .update({ paisId: cambios.paisId });

            return {
                publicacionOperadorId: vinculo.id,
                publicacionId: vinculo.publicacionId,
                fotoAnterior: publicacion.foto,
                fotoActual
            };
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
