import { db } from "../../../infraestructura/persistencia/prisma/db";

export async function obtenerUsuarioOperadorPorNombre(nombreUsuario: string) {
    return db.orm.public.Usuario
        .select("id", "passwordHash", "rol", "habilitado")
        .where({ username: nombreUsuario, rol: "OPERADOR" })
        .first();
}

export async function obtenerUsuarioProductorPorNombre(nombreUsuario: string) {
    return db.orm.public.Usuario
        .select("id", "passwordHash", "rol", "habilitado")
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
        .select("id", "passwordHash", "rol", "habilitado")
        .where({ id: administrador.usuarioId, rol: "ADMINISTRADOR" })
        .first();
}

export async function obtenerIdentidadOperadorPorUsuarioId(usuarioId: number) {
    return db.orm.public.Operador
        .select("nombreFantasia", "fotoPerfil")
        .where({ usuarioId })
        .first();
}

export async function obtenerIdentidadProductorPorUsuarioId(usuarioId: number) {
    return db.orm.public.Productor
        .select("nombreFantasia", "fotoPerfil")
        .where({ usuarioId })
        .first();
}
