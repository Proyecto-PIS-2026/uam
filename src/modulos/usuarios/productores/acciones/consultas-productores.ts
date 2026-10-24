import { db } from "@/infraestructura/persistencia/prisma/db";
import { exigirConsultaProductores } from "@/modulos/identidad-acceso/autorizacion/controles";
import type { PublicacionPerfil } from "../../operadores/consultas-perfil-publico";

export type ProductorListado = {
    id: number;
    nombreFantasia: string;
    fotoPerfil: string | null;
    cantidadProductos: number;
    ubicaciones: string[];
};

export type PerfilProductor = Omit<ProductorListado, "cantidadProductos"> & {
    whatsApp: string;
    publicaciones: PublicacionPerfil[];
};

function publicacionVisible(publicacion: {
    publicacionActiva: boolean;
    publicacionDisponible: boolean;
    tipoPublicacion: string;
}) {
    return publicacion.publicacionActiva && publicacion.publicacionDisponible && publicacion.tipoPublicacion === "PRODUCTOR";
}

export async function obtenerProductoresDisponibles(): Promise<ProductorListado[]> {
    await exigirConsultaProductores("No tenés permiso para consultar productores.",);
    const productores = await db.orm.public.Productor
        .select("id", "nombreFantasia", "fotoPerfil")
        .include("usuario", (usuario) => usuario.select("rol"))
        .include("publicacionesProductor", (publicaciones) => publicaciones
            .include("publicacion", (publicacion) => publicacion.select("publicacionActiva", "publicacionDisponible", "tipoPublicacion"))
            .include("ubicaciones", (ubicaciones) => ubicaciones.select("nombreUbicacion")))
        .all();

    return productores.filter((productor) => productor.usuario.rol === "PRODUCTOR").map((productor) => {
        const publicaciones = productor.publicacionesProductor.filter((relacion) => publicacionVisible(relacion.publicacion));
        return {
            id: productor.id,
            nombreFantasia: productor.nombreFantasia,
            fotoPerfil: productor.fotoPerfil,
            cantidadProductos: publicaciones.length,
            ubicaciones: Array.from(new Set(publicaciones.flatMap((relacion) => relacion.ubicaciones.map((ubicacion) => ubicacion.nombreUbicacion)))),
        };
    }).filter((productor) => productor.cantidadProductos > 0)
        .sort((primero, segundo) => primero.nombreFantasia.localeCompare(segundo.nombreFantasia, "es", { sensitivity: "base" }));
}

export async function obtenerPerfilProductor(nombreFantasia: string): Promise<PerfilProductor | null> {
    await exigirConsultaProductores("No tenés permiso para consultar el perfil del productor.",);
    if (!nombreFantasia.trim()) return null;

    const productor = await db.orm.public.Productor
        .select("id", "nombreFantasia", "fotoPerfil", "whatsApp")
        .include("usuario", (usuario) => usuario.select("rol"))
        .include("publicacionesProductor", (publicaciones) => publicaciones
            .include("pais", (pais) => pais.select("nombrePais"))
            .include("ubicaciones", (ubicaciones) => ubicaciones.select("nombreUbicacion"))
            .include("publicacion", (publicacion) => publicacion
                .select("id", "foto", "precio", "fecha", "cantidadUnidades", "publicacionActiva", "publicacionDisponible", "tipoPublicacion")
                .include("presentacion", (presentacion) => presentacion.include("variedad", (variedad) => variedad.include("especie")))
                .include("categoria")
                .include("calibre")))
        .first({ nombreFantasia });

    if (!productor || productor.usuario.rol !== "PRODUCTOR") return null;

    const publicaciones = productor.publicacionesProductor.filter((relacion) => publicacionVisible(relacion.publicacion));
    return {
        id: productor.id,
        nombreFantasia: productor.nombreFantasia,
        fotoPerfil: productor.fotoPerfil,
        whatsApp: productor.whatsApp,
        ubicaciones: Array.from(new Set(publicaciones.flatMap((relacion) => relacion.ubicaciones.map((ubicacion) => ubicacion.nombreUbicacion)))),
        publicaciones: publicaciones.map((relacion) => {
            const publicacion = relacion.publicacion;
            return {
                id: publicacion.id,
                foto: publicacion.foto,
                precio: publicacion.precio,
                fecha: publicacion.fecha.toString(),
                especie: publicacion.presentacion.variedad.especie.nombreEspecie,
                variedad: publicacion.presentacion.variedad.nombreVariedad,
                presentacion: publicacion.presentacion.nombrePresentacion,
                cantidadUnidades: publicacion.cantidadUnidades,
                categoria: publicacion.categoria.nombreCategoria,
                calibre: publicacion.calibre.codigoCalibre,
                pais: relacion.pais.nombrePais,
            };
        }),
    };
}
