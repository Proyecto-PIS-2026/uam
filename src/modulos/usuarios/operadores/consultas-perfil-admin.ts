import { db } from "../../../infraestructura/persistencia/prisma/db";

// Datos de una publicación tal como los ve el administrador
export type PublicacionPerfilAdmin = {
    id: number;
    foto: string | null;
    precio: string | null;
    disponible: boolean; // El admin ve también las publicaciones no disponibles
    especie: string;
    variedad: string;
    presentacion: string;
    categoria: string;
    calibre: string;
    codigoCalibre: string;
    pais: string;
};

// Datos del perfil de un operador tal como los ve el administrador
export type PerfilAdminOperador = {
    id: number;
    nombreFantasia: string;
    fotoPerfil: string | null;
    whatsApp: string;
    locales: {
        numeroLocal: string;
        nombreNave: string;
        finContrato: string | null; // El admin ve también los locales con contrato vencido
    }[];
    publicaciones: PublicacionPerfilAdmin[];
};

export async function obtenerPerfilAdminOperador(id: number): Promise<PerfilAdminOperador | null> {
    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    // await porque la consulta a la base de datos es asíncrona pero quiero esperar a la respuesta antes de seguir
    const operador = await db.orm.public.Operador
        .select("id", "nombreFantasia", "fotoPerfil", "whatsApp") // Que columnas quiero recuperar de la tabla de operador
        .include("locales", (locales) => locales // Inlcuir los locales asociados al operador
            .select("numeroLocal", "finContrato") // Que columnas quiero recuperar de la tabla de locales
            .include("nave", (nave) => nave.select("nombreNave"))) // Incluir la nave a la que pertenece el local
        .first({ id }); // El primer operador que coincida con el id (es único)

    if (!operador) {
        return null;
    }

    // Al Administrador le mostramos todos locales, ya sea que estén vigentes o no
    // También mostramos operadores aunque ya haya terminado el contrato de todos sus locales
    const locales: PerfilAdminOperador["locales"] = [];

    for (const local of operador.locales) {
        const fin = local.finContrato;
        let finContrato: string | null;
        if (fin == null) {
            finContrato = null;
        } else {
            finContrato = fin.toZonedDateTimeISO("America/Montevideo").toPlainDate().toString();
        }
        locales.push({ 
            numeroLocal: local.numeroLocal, 
            nombreNave: local.nave.nombreNave,
            finContrato
        });
    }

    // Obtener las publicaciones
    const consultaCompleta = db.orm.public.PublicacionOperador // Solo armo la consulta sin ejecutarla
        .where({ operadorId: operador.id })
        .include("pais", (consultaPais) => consultaPais.select("nombrePais"))
        .include("publicacion", (consultaPublicacion) => {
            const camposPublicacion = consultaPublicacion.select(
                "id",
                "foto",
                "precio",
                "publicacionActiva",
                "publicacionDisponible",
                "tipoPublicacion"
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
    const publicaciones: PublicacionPerfilAdmin[] = [];
    
    for (const completa of completas) {
        const publicacion = completa.publicacion;
        const visible = publicacion.publicacionActiva && publicacion.tipoPublicacion === "OPERADOR";
        if (visible) {
            publicaciones.push({
                id: publicacion.id,
                foto: publicacion.foto,
                precio: publicacion.precio,
                disponible: publicacion.publicacionDisponible,
                especie: publicacion.presentacion.variedad.especie.nombreEspecie,
                variedad: publicacion.presentacion.variedad.nombreVariedad,
                presentacion: publicacion.presentacion.nombrePresentacion,
                categoria: publicacion.categoria.nombreCategoria,
                calibre: publicacion.calibre.codigoCalibre,
                codigoCalibre: publicacion.calibre.codigoCalibre,
                pais: completa.pais.nombrePais,
            });
        }
    }

    const operadorResultante: PerfilAdminOperador = {
        id: operador.id,
        nombreFantasia: operador.nombreFantasia,
        fotoPerfil: operador.fotoPerfil,
        whatsApp: operador.whatsApp,
        locales,
        publicaciones,
    };

    return operadorResultante;
}
