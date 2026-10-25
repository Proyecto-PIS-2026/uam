import type { Publicacion } from "./tipos";
import type { obtenerPublicacionesDeOperador } from "./consultas-mi-mercado";

type RelacionesPublicacion = Awaited<ReturnType<typeof obtenerPublicacionesDeOperador>>;

export function mapearPublicacionesMiMercado(relaciones: RelacionesPublicacion): Publicacion[] {
    return relaciones.map((rel) => {
        const pub = rel.publicacion;
        return {
            id: pub.id as number,
            publicacionOperadorId: rel.id,
            paisId: rel.paisId,
            foto: pub.foto as string | null,
            precio: pub.precio === null ? null : String(pub.precio),
            fecha: pub.fecha.toString(),
            version: pub.version,
            publicacionActiva: pub.publicacionActiva as boolean,
            publicacionDisponible: pub.publicacionDisponible as boolean,
            cantidadUnidades: pub.cantidadUnidades as number | null,
            especie: { id: pub.especie.id, nombreEspecie: pub.especie.nombreEspecie, fotoEspecie: pub.especie.fotoEspecie },
            variedad: pub.variedad ? { id: pub.variedad.id, nombreVariedad: pub.variedad.nombreVariedad } : null,
            presentacion: pub.presentacion ? { id: pub.presentacion.id, nombrePresentacion: pub.presentacion.nombrePresentacion } : null,
            categoria: pub.categoria ? { id: pub.categoria.id, nombreCategoria: pub.categoria.nombreCategoria } : null,
            calibre: pub.calibre ? { id: pub.calibre.id, codigoCalibre: pub.calibre.codigoCalibre, nombreCalibre: pub.calibre.nombreCalibre } : null,
        };
    });
}
