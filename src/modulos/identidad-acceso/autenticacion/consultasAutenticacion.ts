import { db } from "../../../infraestructura/persistencia/prisma/db";

export async function obtenerUsuarioOperadorPorNombre(nombreUsuario: string) {
    return db.orm.public.Usuario
        .select("id", "passwordHash", "rol")
        .where({ username: nombreUsuario, rol: "OPERADOR", habilitado: true })
        .first();
}

export async function obtenerUsuarioProductorPorNombre(nombreUsuario: string) {
    return db.orm.public.Usuario
        .select("id", "passwordHash", "rol")
        .where({ username: nombreUsuario, rol: "PRODUCTOR", habilitado: true })
        .first();
}

export async function existeUsuarioPorNombre(nombreUsuario: string) {
    const usuario = await db.orm.public.Usuario
        .select("id")
        .where({ username: nombreUsuario })
        .first();

    return usuario !== null;
}

export async function obtenerUsuarioAdministradorPorCorreo(correo: string) {
    const administrador = await db.orm.public.Administrador
        .select("usuarioId")
        .where({ email: correo })
        .first();

    if (!administrador) return null;

    return db.orm.public.Usuario
        .select("id", "passwordHash", "rol")
        .where({ id: administrador.usuarioId, rol: "ADMINISTRADOR", habilitado: true })
        .first();
}

export async function obtenerFotoPerfilOperadorPorUsuarioId(usuarioId: number) {
    const operador = await db.orm.public.Operador
        .select("fotoPerfil")
        .where({ usuarioId })
        .first();

    return operador?.fotoPerfil ?? null;
}