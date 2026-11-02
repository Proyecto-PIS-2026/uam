"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { exigirProductor } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { guardarUsuarioAtomico } from "@/modulos/usuarios/guardar-usuario-atomico";
import { controlarErrorFotoPerfil, guardarCambioFotoPerfil, validarCambioFotoPerfil } from "@/modulos/usuarios/fotos-perfil";
import { validarModificacionProductor } from "../componentes/modificar-productor-por-admin/validarModificacionProductor";
import type { ResultadoModificacionProductor } from "../componentes/modificar-productor-por-admin/modificarProductor";

export async function modificarMiPerfilProductor(valor: unknown, foto?: FormData): Promise<ResultadoModificacionProductor> {
    const sesion = await controlarSesionEnAccion(exigirProductor);
    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
        return { esValido: false, errores: ["Los datos del productor no son válidos."] };
    }
    const entrada = valor as Record<string, unknown>;
    const validacionFoto = validarCambioFotoPerfil(foto);
    if (!validacionFoto.esValido) return validacionFoto;

    // El destino se obtiene de la sesión dentro de la transacción, nunca del formulario.
    const resultado = await controlarErrorFotoPerfil(() => guardarUsuarioAtomico(async (tx) => {
        const perfil = await tx.orm.public.Productor
            .select("id")
            .where({ usuarioId: sesion.usuarioId })
            .first();
        if (!perfil) return "No se encontró tu perfil de productor.";
        await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1720, ${perfil.id})`
            .returnsRow({ locked: "pg/int4@1" }).build());
        const productor = await tx.orm.public.Productor
            .select("id", "usuarioId", "fotoPerfil")
            .where({ id: perfil.id, usuarioId: sesion.usuarioId })
            .first();
        if (!productor) return "No se encontró tu perfil de productor.";

        const validacion = validarModificacionProductor({
            nombre: entrada.nombre,
            codigoPais: entrada.codigoPais,
            telefono: entrada.telefono,
            productorId: productor.id,
        }, { contactoOpcional: true });
        if (!validacion.esValido) return validacion.errores.join(" ");
        const datos = validacion.datos;
        const repetido = await tx.orm.public.Productor.where({ nombreFantasia: datos.nombre }).first();
        if (repetido && repetido.id !== productor.id) return "Ya existe un productor con ese nombre.";

        const fotoPerfil = await guardarCambioFotoPerfil(tx, "productores", productor.id, productor.fotoPerfil ?? null, validacionFoto.cambio);
        await tx.orm.public.Productor.where({ id: productor.id, usuarioId: sesion.usuarioId }).update({
            nombreFantasia: datos.nombre,
            whatsApp: datos.telefono,
            ...(fotoPerfil !== undefined ? { fotoPerfil } : {}),
        });
        return productor.id;
    }, "productor"));

    if (typeof resultado === "string") return { esValido: false, errores: [resultado] };
    revalidatePath("/", "layout");
    revalidatePath("/productores");
    revalidatePath("/productores/[nombre]", "page");
    revalidatePath("/gestion-productores/[id]", "page");
    revalidatePath("/gestion-productores/[id]/editar", "page");
    revalidatePath("/administracion");
    revalidatePath("/publicaciones-productor");
    return { esValido: true, id: resultado, mensaje: "Tu perfil se actualizó correctamente." };
}
