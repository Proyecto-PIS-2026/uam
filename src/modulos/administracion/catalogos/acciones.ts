"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { bloquearCatalogo, bloquearElemento, consultarCatalogo, eliminarValor, guardarValor, tienePublicaciones } from "./repositorio";
import { ErrorCatalogo, esIdCatalogo, esTipoCatalogo, mensajeConflictoCatalogo, validarDatosCatalogo, valorDuplicado } from "./validaciones";
import type { DatosCatalogo, ElementoCatalogo, ResultadoCatalogo, TipoCatalogo } from "./tipos";

function informarError(error: unknown, eliminando = false): ResultadoCatalogo {
    if (error instanceof ErrorCatalogo) return { ok: false, mensaje: error.message };
    const mensaje = mensajeConflictoCatalogo(error, eliminando);
    if (mensaje) return { ok: false, mensaje };
    console.error("No se pudo actualizar el catálogo administrativo:", error);
    return { ok: false, mensaje: "No se pudo guardar el cambio. Intentá nuevamente." };
}

function actualizarVistas(): void {
    try {
        // Las publicaciones conservan sus referencias y muestran el nuevo nombre en todas las vistas.
        revalidatePath("/", "layout");
    } catch (error) {
        console.error("El catálogo se guardó, pero no se pudieron actualizar las vistas:", error);
    }
}

export async function listarCatalogo(tipo: TipoCatalogo): Promise<ElementoCatalogo[]> {
    await controlarSesionEnAccion(exigirAdministrador);
    if (!esTipoCatalogo(tipo)) throw new ErrorCatalogo("El catálogo no es válido.");
    return consultarCatalogo(db, tipo);
}

export async function guardarElementoCatalogo(tipo: TipoCatalogo, datos: DatosCatalogo, id?: number): Promise<ResultadoCatalogo> {
    await controlarSesionEnAccion(exigirAdministrador);
    try {
        if (!esTipoCatalogo(tipo)) throw new ErrorCatalogo("El catálogo no es válido.");
        if (id !== undefined && !esIdCatalogo(id)) throw new ErrorCatalogo("El valor seleccionado no es válido.");
        const normalizados = validarDatosCatalogo(tipo, datos);
        await db.transaction(async (tx) => {
            await bloquearCatalogo(tx, tipo);
            if (id !== undefined && !await bloquearElemento(tx, tipo, id)) throw new ErrorCatalogo("El valor ya no existe. Actualizá el listado.");
            const existentes = await consultarCatalogo(tx, tipo);
            if (valorDuplicado(tipo, existentes, normalizados, id)) throw new ErrorCatalogo("Ya existe un valor con ese nombre o código en el catálogo.");
            await guardarValor(tx, tipo, normalizados, id);
        });
        actualizarVistas();
        return { ok: true };
    } catch (error) {
        return informarError(error);
    }
}

export async function eliminarElementoCatalogo(tipo: TipoCatalogo, id: number): Promise<ResultadoCatalogo> {
    await controlarSesionEnAccion(exigirAdministrador);
    try {
        if (!esTipoCatalogo(tipo)) throw new ErrorCatalogo("El catálogo no es válido.");
        if (!esIdCatalogo(id)) throw new ErrorCatalogo("El valor seleccionado no es válido.");
        await db.transaction(async (tx) => {
            await bloquearCatalogo(tx, tipo);
            if (!await bloquearElemento(tx, tipo, id)) throw new ErrorCatalogo("El valor ya no existe. Actualizá el listado.");
            if (await tienePublicaciones(tx, tipo, id)) throw new ErrorCatalogo("No se puede eliminar este valor porque tiene publicaciones asociadas.");
            await eliminarValor(tx, tipo, id);
        });
        actualizarVistas();
        return { ok: true };
    } catch (error) {
        return informarError(error, true);
    }
}
