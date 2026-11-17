import { db } from "@/infraestructura/persistencia/prisma/db";
import { calcularFechaMaximaVigencia } from "./vigencia-publicacion";
import { CLAVES_VIGENCIA_PUBLICACIONES, type TipoPropietarioPublicacion } from "./claves-vigencia-publicaciones";

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Coordina cambios de política con altas y ediciones para que ninguna guarde un tope anterior.
export async function bloquearCambioVigenciaPublicaciones(tx: Transaccion): Promise<void> {
    await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1722, 0)`
        .returnsRow({ locked: "pg/int4@1" }).build());
}

async function obtenerFechaMaximaVigencia(tx: Transaccion, tipo: TipoPropietarioPublicacion): Promise<string | null> {
    await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock_shared(1722, 0)`
        .returnsRow({ locked: "pg/int4@1" }).build());

    const [claveHabilitada, claveDias] = CLAVES_VIGENCIA_PUBLICACIONES[tipo];
    const [habilitada, dias] = await Promise.all([
        tx.orm.public.Configuracion
            .where({ nombreConfiguracion: claveHabilitada })
            .select("valorConfiguracion")
            .first(),
        tx.orm.public.Configuracion
            .where({ nombreConfiguracion: claveDias })
            .select("valorConfiguracion")
            .first(),
    ]);
    if (!habilitada || !dias) {
        throw new Error("No se pudo consultar la configuración de vigencia de publicaciones.");
    }
    if (habilitada.valorConfiguracion === "false") return null;
    if (habilitada.valorConfiguracion !== "true") {
        throw new Error("La configuración de vigencia de publicaciones no es válida.");
    }
    return calcularFechaMaximaVigencia(Number(dias.valorConfiguracion));
}

export async function obtenerFechaMaximaVigenciaProductor(tx: Transaccion): Promise<string | null> {
    return obtenerFechaMaximaVigencia(tx, "PRODUCTOR");
}

export async function obtenerFechaMaximaVigenciaOperador(tx: Transaccion): Promise<string | null> {
    return obtenerFechaMaximaVigencia(tx, "OPERADOR");
}
