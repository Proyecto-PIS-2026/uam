import { db } from "../../../infraestructura/persistencia/prisma/db";

import { Temporal } from "@js-temporal/polyfill";

export type OperadorListado = {
    id: number;
    nombreFantasia: string;
    fotoPerfil: string | null;
    cantidadProductos: number;
    locales: {
        numeroLocal: string;
        nombreNave: string;
    }[];
};

export async function obtenerOperadoresPublicos(): Promise<OperadorListado[]> {
    
    const consulta = db.orm.public.Operador
        .select("id", "nombreFantasia", "fotoPerfil")
        .include("locales", (locales) =>
            locales
                .select("numeroLocal", "finContrato")
                .include("nave", (nave) =>
                    nave.select("nombreNave")
                )
        )
        .include("publicacionesOperador", (publicaciones) =>
            publicaciones.include("publicacion", (publicacion) =>
                publicacion.select("publicacionActiva", "publicacionDisponible", "tipoPublicacion")
            )
        );

    const operadores = await consulta.all();
    const hoy = Temporal.Now.plainDateISO("America/Montevideo");
    const operadoresPublicos: OperadorListado[] = [];

    for (const operador of operadores) {
        const localesVigentes: OperadorListado["locales"] = [];
        for (const local of operador.locales) {
            let contratoVigente = local.finContrato === null;
            if (local.finContrato !== null) {
                const fechaFin = local.finContrato.toZonedDateTimeISO("America/Montevideo").toPlainDate();
                contratoVigente = Temporal.PlainDate.compare(fechaFin, hoy) >= 0;
            }
            if (contratoVigente) {
                localesVigentes.push({
                    numeroLocal: local.numeroLocal,
                    nombreNave: local.nave.nombreNave
                });
            }
        }
        if (localesVigentes.length === 0) {
            continue;
        }

        let cantidadProductos = 0;
        for (const relacion of operador.publicacionesOperador) {
            const publicacion = relacion.publicacion;
            if (publicacion.publicacionActiva && publicacion.publicacionDisponible && publicacion.tipoPublicacion === "OPERADOR") {
                cantidadProductos++;
            }
        }

        operadoresPublicos.push({
            id: operador.id,
            nombreFantasia: operador.nombreFantasia,
            fotoPerfil: operador.fotoPerfil,
            cantidadProductos,
            locales: localesVigentes
        });
    }

    operadoresPublicos.sort((primerOperador, segundoOperador) => // es para que siga las reglas del español y base para ignorar mayuscs y tildes
        primerOperador.nombreFantasia.localeCompare( segundoOperador.nombreFantasia, "es", { sensitivity: "base" } )
    );

    return operadoresPublicos;
}
