import { db } from "@/infraestructura/persistencia/prisma/db";
import { exigirConsultaProductores } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerDepartamentos } from "@/compartido/departamentos-uruguay";
import { esPublicacionVencida } from "@/modulos/publicaciones/vigencia/vigencia-publicacion";

export type ProductorListado = {
    id: number;
    nombreFantasia: string;
    fotoPerfil: string | null;
    cantidadProductos: number;
    ubicaciones: string[];
    departamentos: string[];
};

function publicacionVisible(publicacion: {
    publicacionActiva: boolean;
    publicacionDisponible: boolean;
    tipoPublicacion: string;
    fechaVigencia?: { readonly epochNanoseconds: bigint } | null;
}) {
    const estaVencida = esPublicacionVencida(publicacion.fechaVigencia);
    return publicacion.publicacionActiva && publicacion.publicacionDisponible && !estaVencida && publicacion.tipoPublicacion === "PRODUCTOR";
}

export async function obtenerProductoresDisponibles(): Promise<ProductorListado[]> {
    await exigirConsultaProductores("No tenés permiso para consultar productores.",);
    const productores = await db.orm.public.Productor
        .where((productor) => productor.usuario.some((usuario) => usuario.habilitado.eq(true)))
        .select("id", "nombreFantasia", "fotoPerfil")
        .include("usuario", (usuario) => usuario.select("rol"))
        .include("publicacionesProductor", (publicaciones) => publicaciones
            .include("publicacion", (publicacion) => publicacion.select("publicacionActiva", "publicacionDisponible", "tipoPublicacion", "fechaVigencia"))
            .include("ubicaciones", (ubicaciones) => ubicaciones.select("nombreUbicacion", "departamento")))
        .all();

    return productores.filter((productor) => productor.usuario.rol === "PRODUCTOR").map((productor) => {
        const publicaciones = productor.publicacionesProductor.filter((relacion) => publicacionVisible(relacion.publicacion));
        return {
            id: productor.id,
            nombreFantasia: productor.nombreFantasia,
            fotoPerfil: productor.fotoPerfil,
            cantidadProductos: publicaciones.length,
            ubicaciones: Array.from(new Set(publicaciones.flatMap((relacion) => relacion.ubicaciones.map((ubicacion) => ubicacion.nombreUbicacion)))),
            departamentos: obtenerDepartamentos(publicaciones.flatMap((relacion) => relacion.ubicaciones)),
        };
    }).filter((productor) => productor.cantidadProductos > 0)
        .sort((primero, segundo) => primero.nombreFantasia.localeCompare(segundo.nombreFantasia, "es", { sensitivity: "base" }));
}
