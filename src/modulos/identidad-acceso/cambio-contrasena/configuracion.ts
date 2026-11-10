import { db } from "@/infraestructura/persistencia/prisma/db";

export async function estaHabilitadoCambioContrasena(): Promise<boolean> {
    const configuracion = await db.orm.public.Configuracion
        .where({ nombreConfiguracion: "restablecimiento_contrasena_habilitado" })
        .select("valorConfiguracion")
        .first();
    return configuracion?.valorConfiguracion === "true";
}
