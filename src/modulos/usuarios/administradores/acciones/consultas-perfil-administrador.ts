import { db } from "@/infraestructura/persistencia/prisma/db";

export type PerfilAdministrador = {
    id: number;
    usuarioId: number;
    nombreUsuario: string;
    email: string;
    segundoFactorActivado: boolean;
    solicitoRestablecimiento: boolean;
};

export async function obtenerPerfilAdministrador(id: number): Promise<PerfilAdministrador | null> {
    if (!Number.isSafeInteger(id) || id <= 0) {
        return null;
    }

    const administrador = await db.orm.public.Administrador
        .select("id", "usuarioId", "email")
        .include("usuario", (usuario) => usuario.select("username", "twoFactorEnabled", "solicitoRestablecimiento"))
        .where({ id })
        .first();

    if (!administrador) {
        return null;
    }

    return {
        id: administrador.id,
        usuarioId: administrador.usuarioId,
        nombreUsuario: administrador.usuario.username,
        email: administrador.email,
        segundoFactorActivado: administrador.usuario.twoFactorEnabled,
        solicitoRestablecimiento: administrador.usuario.solicitoRestablecimiento,
    };
}


export async function obtenerPerfilAdministradorPorUsuario(usuarioId: number): Promise<PerfilAdministrador | null> {
    const administrador = await db.orm.public.Administrador
        .select("id")
        .where({ usuarioId })
        .first();

    return administrador ? obtenerPerfilAdministrador(administrador.id) : null;
}