import { autorizado } from "../../../identidad-acceso/autorizacion/permisos";
import { db } from "../../../../infraestructura/persistencia/prisma/db";
import { esPublicacionVencida } from "@/modulos/publicaciones/vigencia/vigencia-publicacion";

import { Temporal } from "@js-temporal/polyfill";

export type PublicacionPerfil = {
    id: number;
    foto: string | null;
    precio: string | null;
    fecha: string;
    especie: string;
    variedad: string;
    envase: string;
    kilos: string;
    cantidadUnidades?: number | null;
    comentario?: string | null;
    categoria: string;
    calibre: string;
    codigoCalibre: string;
    pais: string;
};

export type PerfilPublicoOperador = {
    id: number;
    nombreFantasia: string;
    fotoPerfil: string | null;
    whatsApp: string;
    enLicencia?: boolean;
    comentario?: string | null;
    locales: {
        numeroLocal: string;
        nombreNave: string;
    }[];
    publicaciones: PublicacionPerfil[];
}

export async function obtenerPerfilPublicoOperador(nombreFantasia: string): Promise<PerfilPublicoOperador | null> {
    if (!autorizado("operador.catalogo.consultar")) {
        throw new Error("No tiene permisos para consultar el catálogo de Operadores.");
    }

    if (!autorizado("operador.publicacion.consultar")) {
        throw new Error("No tiene permisos para consultar publicaciones de Operadores.");
    }

    if (!nombreFantasia.trim()) {
        return null;
    }

    const operador = await db.orm.public.Operador
        .where((operador) => operador.usuario.some((usuario) => usuario.habilitado.eq(true)))
        .select("id", "nombreFantasia", "fotoPerfil", "whatsApp", "enLicencia", "comentario")
        .include("locales", (locales) => locales
            .select("numeroLocal", "finContrato")
            .include("nave", (nave) => nave.select("nombreNave"))) // Incluir la nave a la que pertenece el local
        .first({ nombreFantasia });

    if (!operador) {
        return null;
    }

    const hoy = Temporal.Now.plainDateISO("America/Montevideo");
    const locales: PerfilPublicoOperador["locales"] = [];

    for (const local of operador.locales) {
        if (local.finContrato !== null) {
            const fechaFin = local.finContrato.toZonedDateTimeISO("America/Montevideo").toPlainDate();
            if (Temporal.PlainDate.compare(fechaFin, hoy) >= 0) {
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
        return null;
    }

    if (operador.enLicencia) {
        return {
            id: operador.id,
            nombreFantasia: operador.nombreFantasia,
            fotoPerfil: operador.fotoPerfil,
            whatsApp: operador.whatsApp,
            enLicencia: true,
            comentario: operador.comentario,
            locales,
            publicaciones: [],
        };
    }

    // Obtener las publicaciones
    const consultaCompleta = db.orm.public.PublicacionOperador
        .where({ operadorId: operador.id })
        .include("pais", (consultaPais) => consultaPais.select("nombrePais"))
        .include("publicacion", (consultaPublicacion) => {
            const camposPublicacion = consultaPublicacion.select(
                "id",
                "foto",
                "precio",
                "fecha",
                "fechaVigencia", 
                "cantidadUnidades",
                "comentario",
                "publicacionActiva",
                "publicacionDisponible",
                "tipoPublicacion"
            );
            const conEnvase = camposPublicacion.include("especie").include("variedad").include("envase").include("kilos");
            const conCategoria = conEnvase.include("categoria");
            const completo = conCategoria.include("calibre");

            return completo;
        });

    const completas = await consultaCompleta.all();
    const publicaciones: PublicacionPerfil[] = [];
    
    for (const completa of completas) {
        const publicacion = completa.publicacion;
        const estaVencida = esPublicacionVencida(publicacion.fechaVigencia);
        const visible = publicacion.publicacionActiva && publicacion.publicacionDisponible && !estaVencida && publicacion.tipoPublicacion === "OPERADOR";
        if (visible) {
            publicaciones.push({
                id: publicacion.id,
                foto: publicacion.foto,
                precio: publicacion.precio,
                fecha: publicacion.fecha.toString(),
                especie: publicacion.especie.nombreEspecie,
                variedad: publicacion.variedad?.nombreVariedad ?? "",
                envase: publicacion.envase?.nombreEnvase ?? "",
                kilos: publicacion.kilos?.valor ?? "",
                cantidadUnidades: publicacion.cantidadUnidades != null ? Number(publicacion.cantidadUnidades) : null,
                comentario: publicacion.comentario,
                categoria: publicacion.categoria?.nombreCategoria ?? "",
                calibre: publicacion.calibre?.nombreCalibre ?? "",
                codigoCalibre: publicacion.calibre?.codigoCalibre ?? "",
                pais: completa.pais?.nombrePais ?? "",
            });
        }
    }

    const operadorResultante: PerfilPublicoOperador = {
        id: operador.id,
        nombreFantasia: operador.nombreFantasia,
        fotoPerfil: operador.fotoPerfil,
        whatsApp: operador.whatsApp,
        locales,
        publicaciones,
    };

    return operadorResultante;
}
