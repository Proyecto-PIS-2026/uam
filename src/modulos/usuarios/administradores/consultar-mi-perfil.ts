import { db } from "@/infraestructura/persistencia/prisma/db";

export type MiPerfilAdministrador = {
    nombre: string;
    correo: string;
};

/** La identidad sale exclusivamente de la sesión validada en la capa de rutas. */
export async function consultarMiPerfilAdministrador(usuarioId: number): Promise<MiPerfilAdministrador | null> {
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) return null;

    const administrador = await db.orm.public.Administrador
        .select("email")
        .include("usuario", (usuario) => usuario.select("username"))
        .where({ usuarioId })
        .first();

    if (!administrador) return null;

    // Nunca exponer passwordHash ni datos de segundo factor al cliente.
    return { nombre: administrador.usuario.username, correo: administrador.email };
}
