import { db } from "../../../../infraestructura/persistencia/prisma/db";

// Una ubicación donde está el producto, con su enlace a Google Maps
export type UbicacionPublicacionProductor = {
    nombre: string;
    urlMaps: string;
};

// Datos de una publicación del productor tal como los ve el administrador
export type PublicacionPerfilAdminProductor = {
    id: number;
    publicacionProductorId: number;
    especieId: number;
    variedadId: number | null;
    presentacionId: number | null;
    categoriaId: number | null;
    calibreId: number | null;
    paisId: number | null;
    foto: string | null;
    precio: string | null;
    cantidadUnidades?: number | null;
    fecha: string;
    disponible: boolean; // El admin ve también las publicaciones no disponibles
    especie: string;
    variedad: string;
    presentacion: string;
    categoria: string;
    calibre: string;
    codigoCalibre: string;
    pais: string;
    ubicaciones: UbicacionPublicacionProductor[]; // Una publicación puede estar en varias ubicaciones
};

// Datos del perfil de un productor tal como los ve el administrador
export type PerfilAdminProductor = {
    id: number;
    nombreFantasia: string;
    fotoPerfil: string | null;
    whatsApp: string;
    publicaciones: PublicacionPerfilAdminProductor[];
};

export async function obtenerPerfilAdminProductor(id: number): Promise<PerfilAdminProductor | null> {
    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    // await porque la consulta a la base de datos es asíncrona pero quiero esperar a la respuesta antes de seguir
    const productor = await db.orm.public.Productor
        .select("id", "nombreFantasia", "fotoPerfil", "whatsApp")
        .first({ id });

    if (!productor) {
        return null;
    }

    // Obtener las publicaciones
    const consultaCompleta = db.orm.public.PublicacionProductor // Solo armo la consulta sin ejecutarla
        .where({ productorId: productor.id })
        .include("pais", (consultaPais) => consultaPais.select("nombrePais"))
        .include("ubicaciones", (consultaUbicaciones) => consultaUbicaciones.select("nombreUbicacion", "urlMaps"))
        .include("publicacion", (consultaPublicacion) => {
            const camposPublicacion = consultaPublicacion.select(
                "id",
                "foto",
                "precio",
                "cantidadUnidades",
                "fecha",
                "publicacionActiva",
                "publicacionDisponible",
                "tipoPublicacion",
                "presentacionId",
                "categoriaId",
                "calibreId"
            );
            const conPresentacion = camposPublicacion.include("especie").include("variedad").include("presentacion");
            const conCategoria = conPresentacion.include("categoria");
            const completo = conCategoria.include("calibre");

            return completo;
        });

    const completas = await consultaCompleta.all(); // La ejecuto con await por ser asincrona
    const publicaciones: PublicacionPerfilAdminProductor[] = [];
    
    for (const completa of completas) {
        const publicacion = completa.publicacion;
        const visible = publicacion.publicacionActiva && publicacion.tipoPublicacion === "PRODUCTOR";
        if (visible) {
            publicaciones.push({
                id: publicacion.id,
                publicacionProductorId: completa.id,
                especieId: publicacion.especie.id,
                variedadId: publicacion.variedad?.id ?? null,
                presentacionId: publicacion.presentacionId,
                categoriaId: publicacion.categoriaId,
                calibreId: publicacion.calibreId,
                paisId: completa.paisId,
                foto: publicacion.foto,
                precio: publicacion.precio,
                cantidadUnidades: publicacion.cantidadUnidades,
                fecha: publicacion.fecha.toString(),
                disponible: publicacion.publicacionDisponible,
                especie: publicacion.especie.nombreEspecie,
                variedad: publicacion.variedad?.nombreVariedad ?? "",
                presentacion: publicacion.presentacion?.nombrePresentacion ?? "",
                categoria: publicacion.categoria?.nombreCategoria ?? "",
                calibre: publicacion.calibre?.codigoCalibre ?? "",
                codigoCalibre: publicacion.calibre?.codigoCalibre ?? "",
                pais: completa.pais?.nombrePais ?? "",
                ubicaciones: completa.ubicaciones.map((ubicacion) => ({
                    nombre: ubicacion.nombreUbicacion,
                    urlMaps: ubicacion.urlMaps,
                })),
            });
        }
    }

    const productorResultante: PerfilAdminProductor = {
        id: productor.id,
        nombreFantasia: productor.nombreFantasia,
        fotoPerfil: productor.fotoPerfil,
        whatsApp: productor.whatsApp,
        publicaciones,
    };

    return productorResultante;
}