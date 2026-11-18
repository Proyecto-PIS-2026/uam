"use server";

import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { validarModificacionAdministrador } from "../validaciones/validar-modificacion-administrador";
import type { ResultadoModificacionAdministrador } from "./modificar-administrador";
import { actualizarNombrePerfilAdministrador } from "../actualizar-nombre-perfil";

export async function modificarMiPerfilAdministrador(valor: unknown): Promise<ResultadoModificacionAdministrador> {
    const sesion = await controlarSesionEnAccion(exigirAdministrador);

    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
        return { esValido: false, errores: ["Los datos del administrador no son válidos."] };
    }

    const entrada = valor as Record<string, unknown>;

    const resultado = await actualizarNombrePerfilAdministrador(sesion.usuarioId, (administradorId) => {
        const validacion = validarModificacionAdministrador({
            administradorId,
            nombreUsuario: entrada.nombreUsuario,
        });
        return validacion.esValido
            ? { esValido: true, nombre: validacion.datos.nombreUsuario }
            : validacion;
    });

    if (!resultado.esValido) {
        return {
            esValido: false,
            errores: resultado.motivo === "perfil-inexistente"
                ? ["No se encontró tu perfil de administrador."]
                : resultado.errores,
        };
    }

    revalidatePath("/", "layout");

    return {
        esValido: true,
        id: resultado.administradorId,
        mensaje: "Tu perfil se actualizó correctamente.",
    };
}
