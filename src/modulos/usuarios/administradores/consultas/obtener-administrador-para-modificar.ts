import { db } from "@/infraestructura/persistencia/prisma/db";

export type AdministradorParaModificar = {
    id: number;
    usuarioId: number;
    nombreUsuario: string;
    email: string;
};

export async function obtenerAdministradorParaModificar(
    administradorId: number,
): Promise<AdministradorParaModificar | null> {
    if (!Number.isSafeInteger(administradorId) || administradorId <= 0) {
        return null;
    }

    const administrador = await db.orm.public.Administrador
        .select("id", "usuarioId", "email")
        .include("usuario", (usuario) => usuario.select("username"))
        .where({ id: administradorId })
        .first();

    if (!administrador) {
        return null;
    }

    return {
        id: administrador.id,
        usuarioId: administrador.usuarioId,
        nombreUsuario: administrador.usuario.username,
        email: administrador.email,
    };
}