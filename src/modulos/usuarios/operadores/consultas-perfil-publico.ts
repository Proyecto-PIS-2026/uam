import { db } from "@/infraestructura/persistencia/prisma/db";

import { Temporal } from "@js-temporal/polyfill";

export type PublicacionPerfil = {
    id: number;
    foto: string | null;
    precio: string | null;
    especie: string;
    variedad: string;
    presentacion: string;
    categoria: string;
    calibre: string;
};

export type PerfilPublicoOperador = {
    id: number;
    nombreFantasia: string;
    whatsApp: string;
    locales: {
        numeroLocal: string;
        nombreNave: string;
    }[];
    publicaciones: PublicacionPerfil[];
}

export async function obtenerPerfilPublicoOperador(id: number): Promise<PerfilPublicoOperador | null> {
    if (!Number.isSafeInteger(id) || id<=0){
        return null;
    }

    // await porque la consulta a la base de datos es asincrona pero quiero esperar a la respuesta antes de seguir
    const operador = await db.orm.public.Operador
                                .select("id", "nombreFantasia", "whatsApp") // Que columnas quiero recuperar de la tabla de operador
                                .include("locales", (locales) => locales // Inlcuir los locales asociados al operador
                                                                    .select("numeroLocal", "finContrato") // Que columnas quiero recuperar de la tabla de locales
                                                                    .include("nave", (nave) => nave.select("nombreNave"))) // Incluir la nave a la que pertenece el local
                                .first({ id }); // El primer operador que tenga este id

    if (!operador) {
        return null;
    }

    // Con que un local este vigente estamos bien (o sin fin de contrato, aunque ahora es obligatorio en el esquema)
    const hoy = Temporal.Now.plainDateISO("America/Montevideo");
    const locales: PerfilPublicoOperador["locales"] = [];

    for (const local of operador.locales) {
        if (local.finContrato !== null) {
            const fechaFin = local.finContrato.toZonedDateTimeISO("America/Montevideo").toPlainDate();
            if (Temporal.PlainDate.compare(fechaFin, hoy) >= 0) { // Si la fechaFin es hoy o viene dsp de hoy
                locales.push({ 
                    numeroLocal: local.numeroLocal, 
                    nombreNave: local.nave.nombreNave 
                });
            }
        } else {
            locales.push({ 
                numeroLocal: local.numeroLocal, 
                nombreNave: local.nave.nombreNave 
            });
        }
    }

    if (locales.length === 0) {
        return null; // Si no tengo locales activos, deberia poder ver el perfil?
    }

    // Obtener las publicaciones
    const consultaCompleta = db.orm.public.PublicacionOperador // Solo armo la consulta sin ejecutarla
        .where({ operadorId: id })
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
    const publicaciones: PublicacionPerfil[] = [];
    
    for (const completa of completas) {
        const publicacion = completa.publicacion;
        const visible = publicacion.publicacionActiva && publicacion.publicacionDisponible && publicacion.tipoPublicacion === "OPERADOR";
        if (visible) {
            publicaciones.push({
                id: publicacion.id,
                foto: publicacion.foto,
                precio: publicacion.precio,
                especie: publicacion.presentacion.variedad.especie.nombreEspecie,
                variedad: publicacion.presentacion.variedad.nombreVariedad,
                presentacion: publicacion.presentacion.nombrePresentacion,
                categoria: publicacion.categoria.nombreCategoria,
                calibre: publicacion.calibre.codigoCalibre,
            });
        }
    }

    const operadorResultante: PerfilPublicoOperador = {
        id: operador.id,
        nombreFantasia: operador.nombreFantasia,
        whatsApp: operador.whatsApp,
        locales,
        publicaciones,
    };

    return operadorResultante;
}