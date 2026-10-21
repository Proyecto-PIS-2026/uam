import { db } from "../../../infraestructura/persistencia/prisma/db";
import { obtenerProductorActual } from "../../usuarios/productores/productor-actual";
import type { Publicacion } from "./componentes/MiMercado";

export type PublicacionMiMercadoProductor = Omit<Publicacion, "publicacionOperadorId"> & {
    publicacionProductorId: number;
    pais: string;
    ubicaciones: {
        id: number;
        nombreUbicacion: string;
        urlMaps: string;
    }[];
};

async function consultarPublicacionesProductor(productorId: number) {
    return db.orm.public.PublicacionProductor
        .where({ productorId })
        .include("pais", (pais) => pais.select("nombrePais"))
        .include("ubicaciones", (ubicaciones) => ubicaciones.select("id", "nombreUbicacion", "urlMaps"))
        .include("publicacion", (publicacion) =>
            publicacion
                .select("id", "foto", "precio", "cantidadUnidades", "fecha", "publicacionActiva", "publicacionDisponible")
                .include("presentacion", (presentacion) =>
                    presentacion.include("variedad", (variedad) => variedad.include("especie")))
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
            pais: relacion.pais.nombrePais,
            foto: publicacion.foto,
            precio: publicacion.precio === null ? null : String(publicacion.precio),
            fecha: publicacion.fecha.toString(),
            publicacionActiva: publicacion.publicacionActiva,
            publicacionDisponible: publicacion.publicacionDisponible,
            cantidadUnidades: publicacion.cantidadUnidades,
            presentacion: {
                id: publicacion.presentacion.id,
                nombrePresentacion: publicacion.presentacion.nombrePresentacion,
                variedad: {
                    id: publicacion.presentacion.variedad.id,
                    nombreVariedad: publicacion.presentacion.variedad.nombreVariedad,
                    especie: {
                        id: publicacion.presentacion.variedad.especie.id,
                        nombreEspecie: publicacion.presentacion.variedad.especie.nombreEspecie,
                        fotoEspecie: publicacion.presentacion.variedad.especie.fotoEspecie,
                    },
                },
            },
            categoria: {
                id: publicacion.categoria.id,
                nombreCategoria: publicacion.categoria.nombreCategoria,
            },
            calibre: {
                id: publicacion.calibre.id,
                codigoCalibre: publicacion.calibre.codigoCalibre,
                nombreCalibre: publicacion.calibre.nombreCalibre,
            },
            ubicaciones: relacion.ubicaciones.map(({ id, nombreUbicacion, urlMaps }) => ({ id, nombreUbicacion, urlMaps })),
        };
}

export async function obtenerPublicacionesMiMercadoProductor() {
    const productor = await obtenerProductorActual();
    const relaciones = await consultarPublicacionesProductor(productor.id);
    const publicaciones = relaciones.map(mapearPublicacionMiMercadoProductor);

    return { productor, publicaciones };
}
