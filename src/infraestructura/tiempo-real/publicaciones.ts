import { db } from "../persistencia/prisma/db";

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CambioPublicacion =
    | { operadorId: number; productorId?: never; publicacionId?: number }
    | { productorId: number; operadorId?: never; publicacionId?: number };

export async function notificarCambioPublicacion(tx: Transaccion, cambio: CambioPublicacion) {
    const contenido = JSON.stringify(cambio);
    await tx.execute(db.raw.sql`SELECT pg_notify('uam_publicaciones', ${contenido})::text AS notificado`
        .returnsRow({ notificado: "pg/text@1" }).build());
}

export async function notificarCambioCatalogoOperador(tx: Transaccion, operadorId: number) {
    await notificarCambioPublicacion(tx, { operadorId });
}

export async function notificarCambioPublicacionProductor(tx: Transaccion, cambio: { productorId: number; publicacionId?: number }) {
    await notificarCambioPublicacion(tx, cambio);
}

export async function notificarCambioCatalogoProductor(tx: Transaccion, productorId: number) {
    await notificarCambioPublicacionProductor(tx, { productorId });
}
