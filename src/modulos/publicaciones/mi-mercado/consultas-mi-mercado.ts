import { db } from "../../../infraestructura/persistencia/prisma/db";
import type { Numeric } from "@prisma/orm-postgres/target/codec-types";

export async function obtenerPublicacionesDeOperador(operadorId: number) {
    const publicaciones = await db.orm.public.PublicacionOperador 
        .where({ operadorId })
        .include("publicacion", (pub) =>
            pub
                .select(
                    "id",
                    "foto",
                    "precio",
                    "fecha",
                    "publicacionActiva",
                    "publicacionDisponible",
                )
                .include("presentacion", (pres) =>
                    pres.include("variedad", (variedad) =>
                        variedad.include("especie"))
                )
                .include("categoria")
                .include("calibre")
        );
    
    const resultado = await publicaciones.all();
    return resultado;
}

export async function actualizarPrecioPublicacion(
    operadorId: number,
    publicacionId: number,
    nuevoPrecio: number
) {
    if (!Number.isFinite(nuevoPrecio) || nuevoPrecio <= 0) {
        throw new Error("El precio debe ser un número mayor a cero.");
    }

    if (!Number.isInteger(nuevoPrecio)) {
        throw new Error("El precio debe ser un número entero, sin decimales.");
    }

    if (nuevoPrecio > 9_999_999_999) {
        throw new Error("El precio excede el valor máximo permitido.");
    }

    const pertenencia = await db.orm.public.PublicacionOperador
        .where({ operadorId, publicacionId })
        .all();

    if (pertenencia.length === 0) {
        throw new Error("La publicación no existe o no pertenece al operador.");
    }

    await db.orm.public.Publicacion
        .where({ id: publicacionId })
        .update({ precio: nuevoPrecio.toFixed(2) as Numeric<12, 2> });
}

