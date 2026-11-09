import { Client } from "pg";

/** Configuración explícita de los casos que prueban recuperación/cambio habilitados. */
export async function conRestablecimientoHabilitado<T>(ejecutar: (cliente: Client) => Promise<T>): Promise<T> {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) throw new Error("Configure DATABASE_URL con la base utilizada por el servidor E2E.");
    const cliente = new Client({ connectionString });
    await cliente.connect();
    try {
        // La configuración es global: los flujos que la preparan no pueden pisar su restauración.
        await cliente.query("SELECT pg_advisory_lock(1752, 1)");
        const nombre = "restablecimiento_contrasena_habilitado";
        const { rows } = await cliente.query<{ valorConfiguracion: string }>(
            'SELECT "valorConfiguracion" FROM configuracion WHERE "nombreConfiguracion" = $1', [nombre],
        );
        if (rows.length !== 1) throw new Error("La seed E2E debe incluir la configuración de restablecimiento de contraseña.");
        const original = rows[0].valorConfiguracion;
        try {
            await cliente.query('UPDATE configuracion SET "valorConfiguracion" = $1 WHERE "nombreConfiguracion" = $2', ["true", nombre]);
            return await ejecutar(cliente);
        } finally {
            await cliente.query('UPDATE configuracion SET "valorConfiguracion" = $1 WHERE "nombreConfiguracion" = $2', [original, nombre]);
        }
    } finally {
        // Cerrar la conexión también libera el bloqueo, incluso si falla la prueba/restauración.
        await cliente.end();
    }
}
