import { db } from "../../../infraestructura/persistencia/prisma/db";

// Datos de una publicación del productor tal como los ve el administrador
export type PublicacionPerfilAdminProductor = {
    id: number;
    publicacionProductorId: number;
    especieId: number;
    variedadId: number;
    presentacionId: number;
    categoriaId: number;
    calibreId: number;
    departamentoId: number;
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
    departamento: string;
    direccion: string;
};

// Datos del perfil de un productor tal como los ve el administrador
export type PerfilAdminProductor = {
    id: number;
    nombreUsuario: string;
    whatsApp: string;
    publicaciones: PublicacionPerfilAdminProductor[];
};

export async function obtenerPerfilAdminProductor(id: number): Promise<PerfilAdminProductor | null> {
    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    // await porque la consulta a la base de datos es asíncrona pero quiero esperar a la respuesta antes de seguir
    const productor = await db.orm.public.Productor
        .select("id", "whatsApp")
        .include("usuario", (usuario) => usuario.select("username"))
        .first({ id });

    if (!productor) {
        return null;
    }

    // Obtener las publicaciones
    const consultaCompleta = db.orm.public.PublicacionProductor // Solo armo la consulta sin ejecutarla
        .where({ productorId: productor.id })
        .include("departamento", (consultaDepartamento) => consultaDepartamento.select("nombreDepartamento"))
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
            const conPresentacion = camposPublicacion.include(
                "presentacion",
                (consultaPresentacion) =>
                    consultaPresentacion.include(
                        "variedad",
                        (consultaVariedad) => consultaVariedad.include("especie")
                    )
            );
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
                especieId: publicacion.presentacion.variedad.especieId,
                variedadId: publicacion.presentacion.variedad.id,
                presentacionId: publicacion.presentacionId,
                categoriaId: publicacion.categoriaId,
                calibreId: publicacion.calibreId,
                departamentoId: completa.departamentoId,
                foto: publicacion.foto,
                precio: publicacion.precio,
                cantidadUnidades: publicacion.cantidadUnidades,
                fecha: publicacion.fecha.toString(),
                disponible: publicacion.publicacionDisponible,
                especie: publicacion.presentacion.variedad.especie.nombreEspecie,
                variedad: publicacion.presentacion.variedad.nombreVariedad,
                presentacion: publicacion.presentacion.nombrePresentacion,
                categoria: publicacion.categoria.nombreCategoria,
                calibre: publicacion.calibre.codigoCalibre,
                codigoCalibre: publicacion.calibre.codigoCalibre,
                departamento: completa.departamento.nombreDepartamento,
                direccion: completa.direccion,
            });
        }
    }

    const productorResultante: PerfilAdminProductor = {
        id: productor.id,
        nombreUsuario: productor.usuario.username,
        whatsApp: productor.whatsApp,
        publicaciones,
    };

    return productorResultante;
}