import { db } from "../../../infraestructura/persistencia/prisma/db";

export async function obtenerUsuarioOperadorPorNombre(nombreUsuario: string) {
    return db.orm.public.Usuario
        .select("id", "passwordHash", "rol")
        .where({ username: nombreUsuario, rol: "OPERADOR" })
        .first();
}

export async function obtenerUsuarioProductorPorNombre(nombreUsuario: string) {
    return db.orm.public.Usuario
        .select("id", "passwordHash", "rol")
        .where({ username: nombreUsuario, rol: "PRODUCTOR" })
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
        .where({ id: administrador.usuarioId, rol: "ADMINISTRADOR" })
        .first();
}

export async function obtenerOperadorAutenticadoPorUsuarioId(usuarioId: number) {
    return db.orm.public.Operador
        .select("id")
        .where({ usuarioId })
        .first();
}

export async function obtenerFotoPerfilOperadorPorUsuarioId(usuarioId: number) {
    const operador = await db.orm.public.Operador
        .select("fotoPerfil")
        .where({ usuarioId })
        .first();

    return operador?.fotoPerfil ?? null;
}
