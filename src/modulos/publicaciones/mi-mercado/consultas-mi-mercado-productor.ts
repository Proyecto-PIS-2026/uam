import { db } from "../../../infraestructura/persistencia/prisma/db";
import { obtenerProductorActual } from "../../usuarios/productores/consultas/productor-actual";
import type { PublicacionMiMercadoProductor } from "../productores/tipos";
import { convertirInstantAFechaVigencia, esPublicacionVencida } from "@/modulos/publicaciones/vigencia/vigencia-publicacion";
import { agregarEstadoFotosPropias } from "../imagenes/vigencia/estado-fotos-propias";
import { agregarEstadoVigenciaPropias } from "../vigencia/estado-vigencia-propias";

async function consultarPublicacionesProductor(productorId: number) {
    return db.orm.public.PublicacionProductor
        .where({ productorId })
        .include("pais", (pais) => pais.select("nombrePais"))
        .include("ubicaciones", (ubicaciones) => ubicaciones.select("id", "nombreUbicacion", "urlMaps", "departamento"))
        .include("publicacion", (publicacion) =>
            publicacion
                .select("id", "foto", "fotoEliminadaPorVencimientoEn", "precio", "cantidadUnidades", "comentario", "fecha", "fechaVigencia", "publicacionActiva", "publicacionDisponible")
                .include("especie")
                .include("variedad")
                .include("envase").include("kilos")
                .include("categoria")
                .include("calibre"))
        .all();

}

type RelacionPublicacionProductor = Awaited<ReturnType<typeof consultarPublicacionesProductor>>[number];

export function mapearPublicacionMiMercadoProductor(relacion: RelacionPublicacionProductor): PublicacionMiMercadoProductor {
        const publicacion = relacion.publicacion;
        return {
            id: publicacion.id,
            publicacionProductorId: relacion.id,
            paisId: relacion.paisId,
            pais: relacion.pais?.nombrePais ?? "",
            foto: publicacion.foto,
            estadoFoto: !publicacion.foto && publicacion.fotoEliminadaPorVencimientoEn ? "eliminada" : null,
            precio: publicacion.precio === null ? null : String(publicacion.precio),
            fecha: publicacion.fecha.toString(),
            fechaVigencia: publicacion.fechaVigencia? convertirInstantAFechaVigencia(publicacion.fechaVigencia): null,
            publicacionActiva: publicacion.publicacionActiva,
            publicacionDisponible: publicacion.publicacionDisponible && !esPublicacionVencida(publicacion.fechaVigencia),
            cantidadUnidades: publicacion.cantidadUnidades,
            comentario: publicacion.comentario,
            especie: {
                id: publicacion.especie.id,
                nombreEspecie: publicacion.especie.nombreEspecie,
                fotoEspecie: publicacion.especie.fotoEspecie,
            },
            variedad: publicacion.variedad ? { id: publicacion.variedad.id, nombreVariedad: publicacion.variedad.nombreVariedad } : null,
            envase: publicacion.envase ? { id: publicacion.envase.id, nombreEnvase: publicacion.envase.nombreEnvase } : null,
            kilos: publicacion.kilos ? { id: publicacion.kilos.id, valor: publicacion.kilos.valor } : null,
            categoria: publicacion.categoria ? { id: publicacion.categoria.id, nombreCategoria: publicacion.categoria.nombreCategoria } : null,
            calibre: publicacion.calibre ? {
                id: publicacion.calibre.id,
                codigoCalibre: publicacion.calibre.codigoCalibre,
                nombreCalibre: publicacion.calibre.nombreCalibre,
            } : null,
            ubicaciones: relacion.ubicaciones.map(({ id, nombreUbicacion, urlMaps, departamento }) => ({ id, nombreUbicacion, urlMaps, departamento })),
        };
}

export async function obtenerPublicacionesMiMercadoProductor() {
    const productor = await obtenerProductorActual();
    const relaciones = await consultarPublicacionesProductor(productor.id);
    const vigencias = await agregarEstadoVigenciaPropias(relaciones.map((relacion) => relacion.publicacion), "PRODUCTOR");
    const publicaciones = await agregarEstadoFotosPropias(relaciones.map((relacion, indice) => ({
        ...mapearPublicacionMiMercadoProductor(relacion),
        estadoVigencia: vigencias[indice].estadoVigencia,
    })), "PRODUCTOR");

    return { productor, publicaciones };
}
