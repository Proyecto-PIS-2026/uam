import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { normalizarDepartamento, obtenerDepartamentos } from "@/compartido/departamentos-uruguay";

export type PublicacionPerfilProductor = {
    id: number;
    foto: string | null;
    precio: string | null;
    fecha: string;
    especie: string;
    variedad: string;
    presentacion: string;
    cantidadUnidades: number | null;
    categoria: string;
    calibre: string;
    pais: string;
    ubicaciones: {
        id: number;
        nombreUbicacion: string;
        urlMaps: string;
        departamento?: string | null;
    }[];
};

export type PerfilProductorPorOperador = {
    id: number;
    nombreFantasia: string;
    fotoPerfil: string | null;
    whatsApp: string;
    departamentos: string[];
    publicaciones: PublicacionPerfilProductor[];
};

export async function obtenerPerfilProductorPorOperador(nombreFantasia: string): Promise<PerfilProductorPorOperador  | null> {
    const sesion = await obtenerSesion();
    if (!autorizado("productor.publicacion.consultar", sesion)) {
            throw new Error("No tiene permisos para consultar las publicaciones del productor.");
    }

    if (!nombreFantasia.trim()) {
        return null;
    }

    // await porque la consulta a la base de datos es asincrona pero quiero esperar a la respuesta antes de seguir
    const productor  = await db.orm.public.Productor
        .select("id", "nombreFantasia", "fotoPerfil", "whatsApp") // Que columnas quiero recuperar de la tabla de productor
        .first({ nombreFantasia });

    if (!productor) {
        return null;
    }

    // Obtener las publicaciones
    const consultaCompleta = db.orm.public.PublicacionProductor // Solo armo la consulta sin ejecutarla
        .where({ productorId: productor.id })
        .include("pais", (consultaPais) => consultaPais.select("nombrePais"))
        .include("ubicaciones", (ubicaciones) =>ubicaciones.select("id", "nombreUbicacion", "urlMaps", "departamento"))
        .include("publicacion", (consultaPublicacion) => {
            const camposPublicacion = consultaPublicacion.select(
                "id",
                "foto",
                "precio",
                "fecha",
                "cantidadUnidades",
                "publicacionActiva",
                "publicacionDisponible",
                "tipoPublicacion"
            );
            const conPresentacion = camposPublicacion.include("especie").include("variedad").include("presentacion");
            const conCategoria = conPresentacion.include("categoria");
            const completo = conCategoria.include("calibre");
            return completo;
        });

    const completas = await consultaCompleta.all(); // La ejecuto con await por ser asincrona
    const publicaciones: PublicacionPerfilProductor[] = [];
    
    for (const completa of completas) {
        const publicacion = completa.publicacion;
        const visible = publicacion.publicacionActiva && publicacion.publicacionDisponible && publicacion.tipoPublicacion === "PRODUCTOR";
        if (visible) {
            publicaciones.push({
                id: publicacion.id,
                foto: publicacion.foto,
                precio: publicacion.precio,
                fecha: publicacion.fecha.toString(),
                especie: publicacion.especie.nombreEspecie,
                variedad: publicacion.variedad?.nombreVariedad ?? "",
                presentacion: publicacion.presentacion?.nombrePresentacion ?? "",
                cantidadUnidades: publicacion.cantidadUnidades != null ? Number(publicacion.cantidadUnidades) : null,
                categoria: publicacion.categoria?.nombreCategoria ?? "",
                calibre: publicacion.calibre?.codigoCalibre ?? "",
                pais: completa.pais?.nombrePais ?? "",
                ubicaciones: completa.ubicaciones.map((ubicacion) => ({
                    id: ubicacion.id,
                    nombreUbicacion: ubicacion.nombreUbicacion,
                    urlMaps: ubicacion.urlMaps,
                    departamento: normalizarDepartamento(ubicacion.departamento),
                })),
            });
        }
    }

    const productorResultante: PerfilProductorPorOperador = {
        id: productor.id,
        nombreFantasia: productor.nombreFantasia,
        fotoPerfil: productor.fotoPerfil,
        whatsApp: productor.whatsApp,
        departamentos: obtenerDepartamentos(publicaciones.flatMap((publicacion) => publicacion.ubicaciones)),
        publicaciones,
    };
    return productorResultante;
}
