"use server";

import { revalidatePath } from "next/cache";
import { Temporal } from "temporal-polyfill";
import { exigirOperador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { guardarOperadorAtomico } from "../guardar-operador-atomico";
import { controlarErrorFotoPerfil, guardarCambioFotoPerfil, validarCambioFotoPerfil } from "../../fotos-perfil";

type DatosPerfil = {
    nombre?: unknown;
    codigoPais?: unknown;
    telefono?: unknown;
    enLicencia?: unknown;
    inicioLicencia?: unknown;
    finLicencia?: unknown;
    comentario?: unknown;
};

export type ResultadoPerfilPropio =
    | { esValido: false; errores: string[] }
    | { esValido: true; mensaje: string };

const REGLAS_TELEFONO: Record<string, RegExp> = {
    "+598": /^9\d{7}$/,
    "+54": /^\d{10,11}$/,
    "+55": /^\d{10,11}$/,
    "+56": /^9\d{8}$/,
    "+595": /^9\d{8}$/,
};

function validarDatos(valor: unknown): { datos: { nombre: string; telefono: string; enLicencia: boolean; inicioLicencia: string | null; finLicencia: string | null; comentario: string | null }; errores: string[] } {
    const errores: string[] = [];
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
        return { datos: { nombre: "", telefono: "", enLicencia: false, inicioLicencia: null, finLicencia: null, comentario: null }, errores: ["Los datos del perfil no son válidos."] };
    }
    const entrada = valor as DatosPerfil;
    const nombre = typeof entrada.nombre === "string" ? entrada.nombre.trim() : "";
    if (!nombre) errores.push("El nombre es obligatorio.");
    if (nombre === "." || nombre === "..") errores.push('El nombre no puede ser "." ni "..".');
    if (nombre.length > 100) errores.push("El nombre no puede superar los 100 caracteres.");
    const codigoPais = typeof entrada.codigoPais === "string" ? entrada.codigoPais.trim() : "";
    const numero = typeof entrada.telefono === "string"
        ? entrada.telefono.trim().replace(/[\s().-]/g, "").replace(/^0+/, "")
        : "";
    const telefono = numero ? `${codigoPais}${numero}` : "";
    if (!numero || !Object.hasOwn(REGLAS_TELEFONO, codigoPais) || !REGLAS_TELEFONO[codigoPais].test(numero)) {
        errores.push("El número de contacto no es válido.");
    }
    const enLicencia = entrada.enLicencia === true;
    const inicioLicencia = typeof entrada.inicioLicencia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entrada.inicioLicencia)
        ? entrada.inicioLicencia
        : null;
    const finLicencia = typeof entrada.finLicencia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entrada.finLicencia)
        ? entrada.finLicencia
        : null;
    if (enLicencia && (!inicioLicencia || !finLicencia)) {
        errores.push("Ingresá las fechas de inicio y fin de la licencia.");
    }
    if (enLicencia && inicioLicencia && finLicencia) {
        try {
            const inicio = Temporal.PlainDate.from(inicioLicencia);
            const fin = Temporal.PlainDate.from(finLicencia);
            if (Temporal.PlainDate.compare(inicio, fin) > 0) errores.push("La fecha de inicio no puede ser posterior a la fecha de fin.");
        } catch {
            errores.push("Las fechas de licencia no son válidas.");
        }
    }
    const comentario = typeof entrada.comentario === "string" ? entrada.comentario.trim() : "";
    if (entrada.comentario !== undefined && typeof entrada.comentario !== "string") {
        errores.push("El mensaje de recomendación no es válido.");
    }
    return {
        datos: {
            nombre,
            telefono,
            enLicencia,
            inicioLicencia,
            finLicencia,
            comentario: enLicencia && inicioLicencia && finLicencia
                ? `Licencia: ${inicioLicencia} - ${finLicencia}\n\n${comentario}`
                : null,
        },
        errores,
    };
}

export async function modificarPerfilPropio(valor: unknown, foto?: FormData): Promise<ResultadoPerfilPropio> {
    const sesion = await controlarSesionEnAccion(exigirOperador);
    const validacion = validarDatos(valor);
    if (validacion.errores.length) return { esValido: false, errores: validacion.errores };
    const validacionFoto = validarCambioFotoPerfil(foto);
    if (!validacionFoto.esValido) return validacionFoto;

    const resultado = await controlarErrorFotoPerfil(() =>
        guardarOperadorAtomico(async (tx) => {
            const operador = await tx.orm.public.Operador
                .select("id", "fotoPerfil")
                .where({ usuarioId: sesion.usuarioId })
                .first();
            if (!operador) return "No se encontró el operador autenticado.";
            const nombreRepetido = await tx.orm.public.Operador
                .where({ nombreFantasia: validacion.datos.nombre })
                .first();
            if (nombreRepetido && nombreRepetido.id !== operador.id) {
                return "Ya existe un operador con ese nombre.";
            }

            const fotoPerfil = await guardarCambioFotoPerfil(
                tx,
                "operadores",
                operador.id,
                operador.fotoPerfil ?? null,
                validacionFoto.cambio,
            );
            await tx.orm.public.Operador.where({ id: operador.id }).update({
                nombreFantasia: validacion.datos.nombre,
                whatsApp: validacion.datos.telefono,
                enLicencia: validacion.datos.enLicencia,
                comentario: validacion.datos.comentario,
                ...(fotoPerfil !== undefined ? { fotoPerfil } : {}),
            });
            return operador.id;
        }, undefined),
    );

    if (typeof resultado === "string") return { esValido: false, errores: [resultado] };
    revalidatePath("/mi-perfil");
    revalidatePath("/operadores");
    revalidatePath("/inicio");
    return { esValido: true, mensaje: "Perfil actualizado correctamente." };
}
