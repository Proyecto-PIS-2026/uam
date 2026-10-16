import { autorizado } from "../../identidad-acceso/autorizacion/permisos";
import type { DatosSesion } from "../../identidad-acceso/autenticacion/sesiones";
import { db } from "../../../infraestructura/persistencia/prisma/db";

export type UbicacionPublicacionProductorListado = {
    id: number;
    nombreUbicacion: string;
    urlMaps: string;
};

export type PublicacionProductorListado = {
    id: number;
    precio: number | null;
    fecha: string;
    foto: string | null;
    especie: string;
    variedad: string;
    presentacion: string;
    cantidadUnidades?: number | null;
    categoria: string;
    calibre: string;
    codigoCalibre: string;
    pais: string;
    productor: {
        id: number;
        nombreFantasia: string;
        fotoPerfil: string | null;
        whatsApp: string;
    };
    ubicaciones: UbicacionPublicacionProductorListado[];
};

export type ResultadoPublicacionesProductores = {
    publicaciones: PublicacionProductorListado[];
};

export async function consultarPublicacionesProductores(sesion: DatosSesion | null): Promise<ResultadoPublicacionesProductores> {
    if (!autorizado("productor.publicacion.consultar", sesion)) throw new Error("No tiene permisos para consultar publicaciones de Productores.");
    const filas = await db.orm.public.PublicacionProductor.where((pp) =>
        pp.publicacion.some((p) =>
            p.publicacionActiva.eq(true),
        ),
    ).where((pp) =>
        pp.publicacion.some((p) =>
            p.publicacionDisponible.eq(true),
        ),
    ).where((pp) =>
        pp.productor.some(),
    ).where((pp) =>
        pp.pais.some(),
    ).include("publicacion", (p) =>
        p.select("id", "precio", "fecha", "foto", "cantidadUnidades").include("presentacion", (pr) =>
            pr.select("nombrePresentacion").include("variedad", (v) =>
                v.select("nombreVariedad").include("especie", (e) =>
                    e.select("nombreEspecie")
                )
            )
        ).include("categoria", (c) =>
            c.select("nombreCategoria")
        )
        .include("calibre", (c) =>
            c.select("nombreCalibre", "codigoCalibre")
        )
    ).include("productor", (p) =>
        p.select("id", "nombreFantasia", "fotoPerfil", "whatsApp")
    ).include("pais", (p) =>
        p.select("nombrePais")
    ).include("ubicaciones", (u) =>
        u.select("id", "nombreUbicacion", "urlMaps")
    ).all();
    const publicaciones: PublicacionProductorListado[] = filas.flatMap((fila): PublicacionProductorListado[] => {
        const p = fila.publicacion;
        const productor = fila.productor;
        const pais = fila.pais;
        const presentacion = p?.presentacion;
        const variedad = presentacion?.variedad;
        const especie = variedad?.especie;
        const categoria = p?.categoria;
        const calibre = p?.calibre;
        if (!p || !productor || !pais || !presentacion || !variedad || !especie || !categoria || !calibre) return [];
        return [{
            id: Number(p.id),
            precio: p.precio === null ? null : Number(p.precio),
            fecha: p.fecha.toString(),
            foto: p.foto,
            especie: especie.nombreEspecie,
            variedad: variedad.nombreVariedad,
            presentacion: presentacion.nombrePresentacion,
            cantidadUnidades: p.cantidadUnidades === null ? null : Number(p.cantidadUnidades),
            categoria: categoria.nombreCategoria,
            calibre: calibre.nombreCalibre,
            codigoCalibre: calibre.codigoCalibre,
            pais: pais.nombrePais,
            productor: {
                id: Number(productor.id),
                nombreFantasia: productor.nombreFantasia,
                fotoPerfil: productor.fotoPerfil,
                whatsApp: productor.whatsApp
            },
            ubicaciones: (fila.ubicaciones ?? []).map((ubicacion) => ({
                id: Number(ubicacion.id),
                nombreUbicacion: ubicacion.nombreUbicacion,
                urlMaps: ubicacion.urlMaps
            }))
        }];
    });
    return { publicaciones };
}