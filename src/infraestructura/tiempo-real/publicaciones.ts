import { db } from "../persistencia/prisma/db";

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CambioPublicacion = { operadorId: number; publicacionId?: number };

export async function notificarCambioPublicacion(tx: Transaccion, cambio: CambioPublicacion) {
    const contenido = JSON.stringify(cambio);
    await tx.execute(db.raw.sql`SELECT pg_notify('uam_publicaciones', ${contenido})::text AS notificado`
        .returnsRow({ notificado: "pg/text@1" }).build());
}

export async function notificarCambioCatalogoOperador(tx: Transaccion, operadorId: number) {
    await notificarCambioPublicacion(tx, { operadorId });
}
