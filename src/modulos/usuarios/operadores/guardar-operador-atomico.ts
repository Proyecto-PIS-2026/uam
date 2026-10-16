import { db } from "@/infraestructura/persistencia/prisma/db";

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

function mensajeConflicto(error: unknown): string | null {
    const revisados = new Set<object>();
    while (typeof error === "object" && error !== null && !revisados.has(error)) {
        revisados.add(error);
        const dato = error as { sqlState?: string; code?: string; constraint?: string; cause?: unknown };
        const codigo = dato.sqlState ?? dato.code;
        if (codigo === "23505") {
            if (dato.constraint === "usuario_username_key") return "Ya existe un usuario con ese nombre de usuario.";
            if (dato.constraint === "operador_nombreFantasia_key") return "Ya existe un operador con ese nombre.";
            if (dato.constraint === "local_numeroLocal_naveId_key") return "Alguno de los locales seleccionados ya pertenece a otro operador. Actualizá el formulario.";
            return "Otro cambio utilizó alguno de los datos seleccionados. Actualizá el formulario.";
        }
        if (codigo === "23503") return "Los datos seleccionados cambiaron mientras se guardaba el operador. Actualizá el formulario.";
        error = dato.cause;
    }
    return null;
}

export async function guardarOperadorAtomico(
    guardar: (tx: Transaccion) => Promise<number | string>,
    operadorId?: number,
): Promise<number | string> {
    try {
        return await db.transaction(async (tx) => {
            await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1720, 0)`
                .returnsRow({ locked: "pg/int4@1" }).build());
            if (operadorId !== undefined) {
                await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ${operadorId})`
                    .returnsRow({ locked: "pg/int4@1" }).build());
            }
            return guardar(tx);
        });
    } catch (error) {
        const mensaje = mensajeConflicto(error);
        if (mensaje) return mensaje;
        throw error;
    }
}
