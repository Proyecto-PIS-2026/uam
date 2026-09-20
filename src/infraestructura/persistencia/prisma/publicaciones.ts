import { db } from "./db";

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