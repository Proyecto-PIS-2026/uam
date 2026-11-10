import { db } from "@/infraestructura/persistencia/prisma/db";
import { guardarUsuarioAtomico } from "../guardar-usuario-atomico";

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function guardarOperadorAtomico(
    guardar: (tx: Transaccion) => Promise<number | string>,
    operadorId?: number,
): Promise<number | string> {
    return guardarUsuarioAtomico(async (tx) => {
        if (operadorId !== undefined) {
            await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ${operadorId})`
                .returnsRow({ locked: "pg/int4@1" }).build());
        }
        return guardar(tx);
    }, "operador");
}
