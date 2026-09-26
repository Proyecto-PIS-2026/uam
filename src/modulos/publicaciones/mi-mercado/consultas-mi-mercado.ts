import { db } from "@/infraestructura/persistencia/prisma/db";

export async function obtenerPublicacionesDeOperador(operadorId: number) {
    const publicaciones = await db.orm.public.PublicacionOperador 
        .where({ operadorId })
        .include("publicacion", (pub) =>
            pub
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

export async function actualizarPrecioPublicacion(operadorId: number, publicacionId: number, nuevoPrecio: number) {
    const pertenencia = await db.orm.public.PublicacionOperador
        .where({ operadorId, publicacionId })
        .all();

    if (pertenencia.length === 0) {
        throw new Error("La publicación no existe o no pertenece al operador.");
    }

    await db.orm.public.Publicacion
        .where({ id: publicacionId })
        .update({ precio: String(nuevoPrecio) as any});
}

