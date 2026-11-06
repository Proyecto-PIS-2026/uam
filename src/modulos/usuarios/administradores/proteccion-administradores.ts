import { db } from "@/infraestructura/persistencia/prisma/db";

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function bloquearYValidarAdministrador(tx: Transaccion, usuarioId: number): Promise<boolean> {
    // La baja y la habilitación comparten el bloqueo hasta confirmar la transacción.
    await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1721, 0)`
        .returnsRow({ locked: "pg/int4@1" }).build());
    const administrador = await tx.orm.public.Usuario
        .where({ id: usuarioId, rol: "ADMINISTRADOR", habilitado: true })
        .select("id").first();
    return administrador !== null && administrador !== undefined;
}

export async function esUltimoAdministradorHabilitado(tx: Transaccion, usuarioId: number): Promise<boolean> {
    const administradores = await tx.orm.public.Usuario
        .where({ rol: "ADMINISTRADOR", habilitado: true }).select("id").all();
    return administradores.length === 1 && administradores[0].id === usuarioId;
}
