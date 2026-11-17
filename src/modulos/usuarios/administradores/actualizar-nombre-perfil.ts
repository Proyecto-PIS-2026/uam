import { db } from "../../../infraestructura/persistencia/prisma/db";

type ValidacionNombre =
    | { esValido: true; nombre: string }
    | { esValido: false; errores: string[] };

type ResultadoActualizacionNombre =
    | { esValido: true; administradorId: number }
    | { esValido: false; motivo: "perfil-inexistente" }
    | { esValido: false; motivo: "datos-invalidos"; errores: string[] };

export async function actualizarNombrePerfilAdministrador(
    usuarioId: number,
    validarNombre: (administradorId: number) => ValidacionNombre,
): Promise<ResultadoActualizacionNombre> {
    return db.transaction(async (tx): Promise<ResultadoActualizacionNombre> => {
        const administrador = await tx.orm.public.Administrador
            .select("id")
            .where({ usuarioId })
            .first();

        if (!administrador) return { esValido: false, motivo: "perfil-inexistente" };

        const validacion = validarNombre(administrador.id);
        if (!validacion.esValido) {
            return { esValido: false, motivo: "datos-invalidos", errores: validacion.errores };
        }

        const nombreExistente = await tx.orm.public.Usuario
            .where({ username: validacion.nombre })
            .select("id")
            .first();
        if (nombreExistente && nombreExistente.id !== usuarioId) {
            return { esValido: false, motivo: "datos-invalidos", errores: ["Ya existe un usuario con ese nombre."] };
        }

        await tx.orm.public.Usuario.where({ id: usuarioId }).update({ username: validacion.nombre });
        return { esValido: true, administradorId: administrador.id };
    });
}
