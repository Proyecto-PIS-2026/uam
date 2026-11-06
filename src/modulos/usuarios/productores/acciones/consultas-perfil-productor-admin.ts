import { db } from "../../../../infraestructura/persistencia/prisma/db";
import { normalizarDepartamento, obtenerDepartamentos } from "@/compartido/departamentos-uruguay";
import { convertirInstantAFechaVigencia } from "@/modulos/publicaciones/vigencia-publicacion";

// Una ubicación donde está el producto, con su enlace a Google Maps
export type UbicacionPublicacionProductor = {
    nombre: string;
    urlMaps: string;
    departamento?: string | null;
};

// Datos de una publicación del productor tal como los ve el administrador
export type PublicacionPerfilAdminProductor = {
    id: number;
    publicacionProductorId: number;
    especieId: number;
    variedadId: number | null;
    envaseId: number | null;
    kilosId: number | null;
    categoriaId: number | null;
    calibreId: number | null;
    paisId: number | null;
    foto: string | null;
    precio: string | null;
    cantidadUnidades?: number | null;
    comentario?: string | null;
    fecha: string;
    fechaVigencia: string | null;
    disponible: boolean; // El admin ve también las publicaciones no disponibles
    especie: string;
    variedad: string;
    envase: string;
    kilos: string;
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
    departamentos: string[];
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
        .include("ubicaciones", (consultaUbicaciones) => consultaUbicaciones.select("nombreUbicacion", "urlMaps", "departamento"))
        .include("publicacion", (consultaPublicacion) => {
            const camposPublicacion = consultaPublicacion.select(
                "id",
                "foto",
                "precio",
                "cantidadUnidades",
                "comentario",
                "fecha",
                "fechaVigencia",
                "publicacionActiva",
                "publicacionDisponible",
                "tipoPublicacion",
                "envaseId", "kilosId",
                "categoriaId",
                "calibreId"
            );
            const conEnvase = camposPublicacion.include("especie").include("variedad").include("envase").include("kilos");
            const conCategoria = conEnvase.include("categoria");
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
                envaseId: publicacion.envaseId,
                kilosId: publicacion.kilosId,
                categoriaId: publicacion.categoriaId,
                calibreId: publicacion.calibreId,
                paisId: completa.paisId,
                foto: publicacion.foto,
                precio: publicacion.precio,
                cantidadUnidades: publicacion.cantidadUnidades,
                comentario: publicacion.comentario,
                fecha: publicacion.fecha.toString(),
                fechaVigencia: publicacion.fechaVigencia? convertirInstantAFechaVigencia(publicacion.fechaVigencia): null,
                disponible: publicacion.publicacionDisponible,
                especie: publicacion.especie.nombreEspecie,
                variedad: publicacion.variedad?.nombreVariedad ?? "",
                envase: publicacion.envase?.nombreEnvase ?? "",
                kilos: publicacion.kilos?.valor ?? "",
                categoria: publicacion.categoria?.nombreCategoria ?? "",
                calibre: publicacion.calibre?.codigoCalibre ?? "",
                codigoCalibre: publicacion.calibre?.codigoCalibre ?? "",
                pais: completa.pais?.nombrePais ?? "",
                ubicaciones: completa.ubicaciones.map((ubicacion) => ({
                    nombre: ubicacion.nombreUbicacion,
                    urlMaps: ubicacion.urlMaps,
                    departamento: normalizarDepartamento(ubicacion.departamento),
                })),
            });
        }
    }

    const productorResultante: PerfilAdminProductor = {
        id: productor.id,
        nombreFantasia: productor.nombreFantasia,
        fotoPerfil: productor.fotoPerfil,
        whatsApp: productor.whatsApp,
        departamentos: obtenerDepartamentos(publicaciones.flatMap((publicacion) => publicacion.ubicaciones)),
        publicaciones,
    };

    return productorResultante;
}
