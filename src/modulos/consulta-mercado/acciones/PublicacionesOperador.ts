import { autorizado } from "../../identidad-acceso/autorizacion/permisos";
import { db } from "../../../infraestructura/persistencia/prisma/db";
import "temporal-polyfill/full/global";
import { or } from "@prisma/orm-postgres/orm-client";

export type PublicacionListado = {
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
    tipoPublicacion: "OPERADOR";
    operador: {
        id: number;
        nombreFantasia: string;
        whatsApp: string;
    };
};

export type ResultadoPublicaciones = {
    publicaciones: PublicacionListado[];
};

export async function consultarPublicaciones(): Promise<ResultadoPublicaciones> {
    if (!autorizado("operador.publicacion.consultar")) throw new Error("No tiene permisos para consultar publicaciones de Operadores.");
    const zonaHoraria = "America/Montevideo";
    const hoy = Temporal.Now.plainDateISO(zonaHoraria);
    const inicioHoy = hoy.toZonedDateTime({ timeZone: zonaHoraria, plainTime: Temporal.PlainTime.from("00:00") }).toInstant();
    const filas = await db.orm.public.PublicacionOperador.where((po) => 
        po.publicacion.some((p) => 
            p.publicacionActiva.eq(true)
        )
    ).where((po) => 
        po.publicacion.some((p) => 
            p.publicacionDisponible.eq(true)
        )
    ).where((po) => 
        po.operador.some((o) =>
            o.locales.some((l) =>
                or(l.finContrato.isNull(), l.finContrato.gte(inicioHoy))
            )
        )
    ).where((po) => 
        po.pais.some()
    ).include("publicacion", (p) =>
        p.select("id", "precio", "fecha", "foto", "cantidadUnidades", "tipoPublicacion").include("presentacion", (pr) =>
            pr.select("nombrePresentacion").include("variedad", (v) =>
                v.select("nombreVariedad").include("especie", (e) =>
                    e.select("nombreEspecie")
                ),
            ),
        ).include("categoria", (c) =>
            c.select("nombreCategoria")
        ).include("calibre", (c) =>
            c.select("nombreCalibre", "codigoCalibre")
        )
    ).include("pais", (pa) => 
        pa.select("nombrePais")
    ).include("operador", (o) =>
        o.select("id", "nombreFantasia", "whatsApp")
    ).all();
    const publicaciones: PublicacionListado[] = filas.flatMap((fila): PublicacionListado[] => {
        const p = fila.publicacion;
        const pais = fila.pais;
        const operador = fila.operador;
        const presentacion = p?.presentacion;
        const variedad = presentacion?.variedad;
        const especie = variedad?.especie;
        const categoria = p?.categoria;
        const calibre = p?.calibre;
        const tipoPublicacion = p?.tipoPublicacion;
        if (!p || !pais || !operador || !presentacion || !variedad || !especie || !categoria || !calibre || tipoPublicacion !== "OPERADOR") return [];
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
            tipoPublicacion,
            operador: {
                id: Number(operador.id),
                nombreFantasia: operador.nombreFantasia,
                whatsApp: operador.whatsApp,
            },
        }];
    });
    return { publicaciones };
}