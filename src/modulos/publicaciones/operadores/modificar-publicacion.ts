import { db } from "@/infraestructura/persistencia/prisma/db";
import { eliminarImagenPublicacionGestionada, ErrorImagenPublicacion, guardarImagenPublicacion } from "./imagenes-publicacion";

type PrecioDb = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];

export type CambiosPublicacionOperador = {
    precio: string | null;
    foto: string | null;
    categoriaId: number;
    calibreId: number;
    presentacionId: number;
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

    let precioParaGuardar: PrecioDb = null;

    if (cambios.precio !== null) {
        if (typeof cambios.precio !== "string") {
            throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", "El precio no es válido.");
        }
        const precio = cambios.precio.trim();
        const formatoValido = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(precio);
        if (!formatoValido) {
            throw new ErrorEdicionPublicacion("DATOS_INVALIDOS","El precio debe tener hasta 10 dígitos enteros y 2 decimales.");
        }
        precioParaGuardar = precio as PrecioDb;
    }

    const imagenNuevaGuardada: { url: string | null; publicacionId: number | null } = { url: null, publicacionId: null };
    let resultado: { publicacionOperadorId: number; publicacionId: number; fotoAnterior: string | null; fotoActual: string | null };

    try {
        resultado = await db.transaction(async (tx) => {
            const operador = await tx.orm.public.Operador
                .select("id")
                .where({ usuarioId: usuarioIdAutenticado })
                .first();

            if (!operador) {
                throw new ErrorEdicionPublicacion("NO_ENCONTRADA", "Operador no encontrado.");
            }

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

            if (fotoNueva) {
                try {
                    imagenNuevaGuardada.url = await guardarImagenPublicacion(vinculo.publicacionId, fotoNueva);
                    imagenNuevaGuardada.publicacionId = vinculo.publicacionId;
                } catch (error) {
                    if (error instanceof ErrorImagenPublicacion) {
                        throw new ErrorEdicionPublicacion("DATOS_INVALIDOS", error.message);
                    }
                    throw error;
                }
            }

            const fotoActual = imagenNuevaGuardada.url ?? cambios.foto;

            await tx.orm.public.Publicacion
                .where({ id: vinculo.publicacionId })
                .update({
                    precio: precioParaGuardar,
                    foto: fotoActual,
                    categoriaId: cambios.categoriaId,
                    calibreId: cambios.calibreId,
                    presentacionId: cambios.presentacionId
            });

        return {
            publicacionOperadorId: vinculo.id,
            publicacionId: vinculo.publicacionId,
            fotoAnterior: publicacion.foto,
            fotoActual
        };
        });
    } catch (error) {
        if (imagenNuevaGuardada.url && imagenNuevaGuardada.publicacionId !== null) {
            try {
                await eliminarImagenPublicacionGestionada(imagenNuevaGuardada.url, imagenNuevaGuardada.publicacionId);
            } catch (errorLimpieza) {
                console.error("No se pudo eliminar la imagen tras fallar la edición:", errorLimpieza);
            }
        }
        throw error;
    }

    if (resultado.fotoAnterior !== resultado.fotoActual) {
        try {
            await eliminarImagenPublicacionGestionada(resultado.fotoAnterior, resultado.publicacionId);
        } catch (error) {
            console.error("No se pudo eliminar la imagen anterior:", error);
        }
    }

    return { publicacionOperadorId: resultado.publicacionOperadorId, publicacionId: resultado.publicacionId };
}
