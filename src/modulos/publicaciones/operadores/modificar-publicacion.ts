import { db } from "@/infraestructura/persistencia/prisma/db";

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
    cambios: CambiosPublicacionOperador
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

    return db.transaction(async (tx) => {
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
            .select("tipoPublicacion")
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

        await tx.orm.public.Publicacion
            .where({ id: vinculo.publicacionId })
            .update({
                precio: precioParaGuardar,
                foto: cambios.foto,
                categoriaId: cambios.categoriaId,
                calibreId: cambios.calibreId,
                presentacionId: cambios.presentacionId
            });

        return {
            publicacionOperadorId: vinculo.id,
            publicacionId: vinculo.publicacionId
        };
    });
}