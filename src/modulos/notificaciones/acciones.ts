"use server";

import { db } from "@/infraestructura/persistencia/prisma/db";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { revalidatePath } from "next/cache";

async function usuarioActual() {
    const sesion = await obtenerSesion();
    if (!sesion) throw new ErrorAutorizacion(401, "Iniciá sesión para continuar.");
    return sesion.usuarioId;
}

export async function listarNotificaciones() {
    const usuarioId = await usuarioActual();
    const filas = await db.orm.public.Notificacion.where({ usuarioId }).all();
    return filas.map(({ id, titulo, descripcion, vista }) => ({
        id, titulo, descripcion, vista, fecha: null as string | null,
    })).sort((a, b) => b.id - a.id);
}

export async function contarNotificacionesSinLeer() {
    const usuarioId = await usuarioActual();
    return (await db.orm.public.Notificacion.where({ usuarioId, vista: false }).select("id").all()).length;
}

export async function modificarNotificaciones(accion: "leer", id?: number) {
    const usuarioId = await usuarioActual();
    if (accion !== "leer") throw new Error("Acción inválida.");
    if (id !== undefined && (!Number.isSafeInteger(id) || id <= 0)) throw new Error("Notificación inválida.");
    const consulta = db.orm.public.Notificacion.where({ usuarioId, ...(id === undefined ? {} : { id }) });
    await consulta.delete();
    revalidatePath("/", "layout");
}
