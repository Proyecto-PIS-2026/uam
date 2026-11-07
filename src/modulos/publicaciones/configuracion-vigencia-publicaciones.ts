import { db } from "@/infraestructura/persistencia/prisma/db";
import { calcularFechaMaximaVigencia } from "./vigencia-publicacion";

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Coordina cambios de política con altas y ediciones para que ninguna guarde un tope anterior.
export async function bloquearCambioVigenciaPublicaciones(tx: Transaccion): Promise<void> {
    await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1722, 0)`
        .returnsRow({ locked: "pg/int4@1" }).build());
}

export async function obtenerFechaMaximaVigenciaProductor(tx: Transaccion): Promise<string | null> {
    await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock_shared(1722, 0)`
        .returnsRow({ locked: "pg/int4@1" }).build());

    const [habilitada, dias] = await Promise.all([
        tx.orm.public.Configuracion
            .where({ nombreConfiguracion: "vigencia_publicaciones_productor_habilitada" })
            .select("valorConfiguracion")
            .first(),
        tx.orm.public.Configuracion
            .where({ nombreConfiguracion: "vigencia_publicaciones_productor" })
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
