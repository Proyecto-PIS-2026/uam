import { db } from "../../../infraestructura/persistencia/prisma/db";
import { obtenerProductorActual } from "../../usuarios/productores/acciones/productor-actual";
import type { Publicacion } from "./tipos";

export type PublicacionMiMercadoProductor = Omit<Publicacion, "publicacionOperadorId" | "version"> & {
    publicacionProductorId: number;
    pais: string;
    ubicaciones: {
        id: number;
        nombreUbicacion: string;
        urlMaps: string;
        departamento?: string | null;
    }[];
};

async function consultarPublicacionesProductor(productorId: number) {
    return db.orm.public.PublicacionProductor
        .where({ productorId })
        .include("pais", (pais) => pais.select("nombrePais"))
        .include("ubicaciones", (ubicaciones) => ubicaciones.select("id", "nombreUbicacion", "urlMaps", "departamento"))
        .include("publicacion", (publicacion) =>
            publicacion
                .select("id", "foto", "precio", "cantidadUnidades", "fecha", "publicacionActiva", "publicacionDisponible")
                .include("especie")
                .include("variedad")
                .include("presentacion")
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
            precio: publicacion.precio === null ? null : String(publicacion.precio),
            fecha: publicacion.fecha.toString(),
            publicacionActiva: publicacion.publicacionActiva,
            publicacionDisponible: publicacion.publicacionDisponible,
            cantidadUnidades: publicacion.cantidadUnidades,
            especie: {
                id: publicacion.especie.id,
                nombreEspecie: publicacion.especie.nombreEspecie,
                fotoEspecie: publicacion.especie.fotoEspecie,
            },
            variedad: publicacion.variedad ? { id: publicacion.variedad.id, nombreVariedad: publicacion.variedad.nombreVariedad } : null,
            presentacion: publicacion.presentacion ? { id: publicacion.presentacion.id, nombrePresentacion: publicacion.presentacion.nombrePresentacion } : null,
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
    const publicaciones = relaciones.map(mapearPublicacionMiMercadoProductor);

    return { productor, publicaciones };
}
