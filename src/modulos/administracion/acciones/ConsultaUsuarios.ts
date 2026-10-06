import { db } from "../../../infraestructura/persistencia/prisma/db";
import type { DatosModificarUsuarios, TipoNave, UsuarioParaModificar } from "../componentes/Compartidos/Tipos";

export default async function consultarDatosModificarUsuarios(): Promise<DatosModificarUsuarios> {
    const [administradores, operadores, productores] = await Promise.all([
        db.orm.public.Administrador
            .select("id", "usuarioId", "email")
            .include("usuario", (usuario) => usuario.select("id", "username", "rol"))
            .all(),
        db.orm.public.Operador
            .select("id", "usuarioId", "nombreFantasia", "whatsApp", "fotoPerfil", "comentario")
            .include("usuario", (usuario) => usuario.select("id", "username", "rol"))
            .include("locales", (local) =>
                local.select("id", "numeroLocal", "finContrato")
                    .include("nave", (nave) => nave.select("nombreNave"))
            )
            .all(),
        db.orm.public.Productor
            .select("id", "usuarioId", "whatsApp")
            .include("usuario", (usuario) => usuario.select("id", "username", "rol"))
            .all(),
    ]);

    const usuarios: UsuarioParaModificar[] = [
        ...administradores.map((administrador) => ({
            id: administrador.usuario.id,
            username: administrador.usuario.username,
            rol: "ADMINISTRADOR" as const,
            administradorId: administrador.id,
            email: administrador.email,
        })),
        ...operadores.map((operador) => ({
            id: operador.usuario.id,
            username: operador.usuario.username,
            rol: "OPERADOR" as const,
            operadorId: operador.id,
            nombreFantasia: operador.nombreFantasia,
            whatsApp: operador.whatsApp,
            fotoPerfil: operador.fotoPerfil,
            comentario: operador.comentario,
            locales: operador.locales.map((local) => ({
                id: local.id,
                numeroLocal: Number(local.numeroLocal),
                finContrato: local.finContrato ? local.finContrato.toString() : null,
                nave: local.nave.nombreNave as TipoNave,
            })),
        })),
        ...productores.map((productor) => ({
            id: productor.usuario.id,
            username: productor.usuario.username,
            rol: "PRODUCTOR" as const,
            productorId: productor.id,
            whatsApp: productor.whatsApp,
        })),
    ];

    return { usuarios };
}