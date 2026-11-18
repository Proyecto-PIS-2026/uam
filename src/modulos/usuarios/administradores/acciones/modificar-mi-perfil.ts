"use server";

import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { actualizarNombrePerfilAdministrador } from "../actualizar-nombre-perfil";

type DatosMiPerfil = { nombre: string };
type Resultado = { esValido: true; mensaje: string } | { esValido: false; errores: string[] };

function validarDatos(valor: unknown): { esValido: true; datos: DatosMiPerfil } | { esValido: false; errores: string[] } {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
        return { esValido: false, errores: ["Los datos del perfil no son válidos."] };
    }
    const entrada = valor as Record<string, unknown>;
    const nombre = typeof entrada.nombre === "string" ? entrada.nombre.trim() : "";
    const errores: string[] = [];
    if (nombre.length < 3) errores.push("El nombre de usuario debe tener al menos 3 caracteres.");
    return errores.length > 0 ? { esValido: false, errores } : { esValido: true, datos: { nombre } };
}

/** Edición propia: no se acepta usuarioId/administradorId/rol del cliente. */
export async function modificarMiPerfilAdministrador(valor: unknown): Promise<Resultado> {
    const sesion = await controlarSesionEnAccion(exigirAdministrador);
    const validacion = validarDatos(valor);
    if (!validacion.esValido) return validacion;

    const { nombre } = validacion.datos;
    try {
        const resultado = await actualizarNombrePerfilAdministrador(sesion.usuarioId, () => ({ esValido: true, nombre }));
        if (!resultado.esValido) {
            return {
                esValido: false,
                errores: resultado.motivo === "perfil-inexistente"
                    ? ["No se pudo encontrar tu perfil."]
                    : resultado.errores,
            };
        }
    } catch {
        // Incluye fallos de persistencia y carreras de unicidad; nunca informar éxito.
        return { esValido: false, errores: ["No se pudieron guardar los cambios. Intentá nuevamente."] };
    }

    revalidatePath("/mi-perfil");
    revalidatePath("/administracion");
    return { esValido: true, mensaje: "Perfil actualizado correctamente." };
}
