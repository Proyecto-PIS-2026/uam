import { db } from "../../../infraestructura/persistencia/prisma/db";
import { agregarEstadoFotosPropias } from "../imagenes/vigencia/estado-fotos-propias";
import { agregarEstadoVigenciaPropias } from "../vigencia/estado-vigencia-propias";

export async function obtenerPublicacionesDeOperador(operadorId: number) {
    const publicaciones = await db.orm.public.PublicacionOperador 
        .where({ operadorId })
        .include("publicacion", (pub) =>
            pub
                .select(
                    "id",
                    "foto",
                    "fotoEliminadaPorVencimientoEn",
                    "precio",
                    "cantidadUnidades",
                    "comentario",
                    "fecha",
                    "fechaVigencia",
                    "version",
                    "publicacionActiva",
                    "publicacionDisponible",
                )
                .include("especie")
                .include("variedad")
                .include("envase").include("kilos")
                .include("categoria")
                .include("calibre")
        );
    
    const resultado = await publicaciones.all();
    const fotos = await agregarEstadoFotosPropias(resultado.map((relacion) => relacion.publicacion), "OPERADOR");
    const vigentes = await agregarEstadoVigenciaPropias(fotos, "OPERADOR");
    return resultado.map((relacion, indice) => ({ ...relacion, publicacion: vigentes[indice] }));
}
