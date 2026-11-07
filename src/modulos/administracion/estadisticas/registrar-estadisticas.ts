import { Temporal } from "temporal-polyfill";
import { db } from "@/infraestructura/persistencia/prisma/db";

export function obtenerFechaEstadistica(): string {
    return Temporal.Now.plainDateISO("America/Montevideo").toString();
}

// La fecha representa un día del negocio, almacenado a medianoche UTC.
// ON CONFLICT cubre tanto el primer registro concurrente como los incrementos.
export async function registrarVisita(tipoVisitante: string, fecha = obtenerFechaEstadistica()): Promise<void> {
    await db.runtime().query(db.raw.sql`
        INSERT INTO "estadisticaVisita" (fecha, "tipoVisitante", cantidad)
        VALUES (${`${fecha}T00:00:00Z`}::timestamptz, ${tipoVisitante}, 1)
        ON CONFLICT (fecha, "tipoVisitante") DO UPDATE
        SET cantidad = "estadisticaVisita".cantidad + 1
        RETURNING cantidad
    `.returnsRow({ cantidad: "pg/int4@1" }).build());
}

export async function registrarContacto(username: string, fecha = obtenerFechaEstadistica()): Promise<void> {
    await db.runtime().query(db.raw.sql`
        INSERT INTO "estadisticaContacto" (fecha, username, cantidad)
        VALUES (${`${fecha}T00:00:00Z`}::timestamptz, ${username}, 1)
        ON CONFLICT (fecha, username) DO UPDATE
        SET cantidad = "estadisticaContacto".cantidad + 1
        RETURNING cantidad
    `.returnsRow({ cantidad: "pg/int4@1" }).build());
}

export async function registrarPublicacion(username: string, fecha = obtenerFechaEstadistica()): Promise<void> {
    await db.runtime().query(db.raw.sql`
        INSERT INTO "estadisticaPublicacion" (fecha, username, cantidad)
        VALUES (${`${fecha}T00:00:00Z`}::timestamptz, ${username}, 1)
        ON CONFLICT (fecha, username) DO UPDATE
        SET cantidad = "estadisticaPublicacion".cantidad + 1
        RETURNING cantidad
    `.returnsRow({ cantidad: "pg/int4@1" }).build());
}
