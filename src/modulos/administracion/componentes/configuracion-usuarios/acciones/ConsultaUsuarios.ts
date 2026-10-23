import { db } from "../../../../../infraestructura/persistencia/prisma/db";
import type { DatosModificarUsuarios, UsuarioParaModificar } from "../Tipos";

export default async function consultarDatosModificarUsuarios(): Promise<DatosModificarUsuarios> {
    const [administradores, operadores, productores] = await Promise.all([
        db.orm.public.Administrador
            .select("id", "email")
            .include("usuario", (usuario) =>
                usuario.select("id", "username", "rol", "solicitoRestablecimiento")
            )
            .all(),
        db.orm.public.Operador
            .select("id", "nombreFantasia")
            .include("usuario", (usuario) =>
                usuario.select("id", "username", "rol", "solicitoRestablecimiento")
            )
            .all(),
        db.orm.public.Productor
            .select("id", "nombreFantasia")
            .include("usuario", (usuario) =>
                usuario.select("id", "username", "rol", "solicitoRestablecimiento")
            )
            .all(),
    ]);

    const usuarios: UsuarioParaModificar[] = [
        ...administradores.map((administrador) => ({
            id: administrador.usuario.id,
            username: administrador.usuario.username,
            rol: "ADMINISTRADOR" as const,
            administradorId: administrador.id,
            email: administrador.email,
            solicitoRestablecimiento: administrador.usuario.solicitoRestablecimiento,
        })),
        ...operadores.map((operador) => ({
            id: operador.usuario.id,
            username: operador.usuario.username,
            rol: "OPERADOR" as const,
            operadorId: operador.id,
            nombreFantasia: operador.nombreFantasia,
            solicitoRestablecimiento: operador.usuario.solicitoRestablecimiento,
        })),
        ...productores.map((productor) => ({
            id: productor.usuario.id,
            username: productor.usuario.username,
            rol: "PRODUCTOR" as const,
            productorId: productor.id,
            nombreFantasia: productor.nombreFantasia,
            solicitoRestablecimiento: productor.usuario.solicitoRestablecimiento,
        })),
    ];

    return { usuarios };
}
