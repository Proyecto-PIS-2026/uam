import type { Publicacion } from "./componentes/MiMercado";
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
            publicacionActiva: pub.publicacionActiva as boolean,
            publicacionDisponible: pub.publicacionDisponible as boolean,
            cantidadUnidades: pub.cantidadUnidades as number | null,
            presentacion: {
                id: pub.presentacion.id,
                nombrePresentacion: pub.presentacion.nombrePresentacion,
                variedad: {
                    id: pub.presentacion.variedad.id,
                    nombreVariedad: pub.presentacion.variedad.nombreVariedad,
                    especie: {
                        id: pub.presentacion.variedad.especie.id,
                        nombreEspecie: pub.presentacion.variedad.especie.nombreEspecie,
                        fotoEspecie: pub.presentacion.variedad.especie.fotoEspecie,
                    },
                },
            },
            categoria: { id: pub.categoria.id, nombreCategoria: pub.categoria.nombreCategoria },
            calibre: {
                id: pub.calibre.id,
                codigoCalibre: pub.calibre.codigoCalibre,
                nombreCalibre: pub.calibre.nombreCalibre,
            },
        };
    });
}
