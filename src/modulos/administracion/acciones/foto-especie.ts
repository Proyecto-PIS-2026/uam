"use server";

import { db } from "@/infraestructura/persistencia/prisma/db";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { guardarImagenEspecie } from "./imagenes-especies";
import { limpiarImagenEspecieNoReferenciada } from "./limpiar-imagen-especie";

export async function guardarFotoEspecie(especieId: number, archivo: File): Promise<void> {
    await controlarSesionEnAccion(exigirAdministrador);
    if (!Number.isSafeInteger(especieId) || especieId <= 0) {
        throw new Error("La especie no es válida.");
    }
    const especie = await db.orm.public.Especie
        .select("fotoEspecie")
        .where({ id: especieId })
        .first();

    if (!especie) {
        throw new Error("La especie no existe.");
    }
    const fotoAnterior = especie.fotoEspecie;
    const fotoNueva = await guardarImagenEspecie(especieId, archivo);
    try {
        const actualizada = await db.orm.public.Especie
            .where({ id: especieId, fotoEspecie: fotoAnterior })
            .select("id")
            .update({ fotoEspecie: fotoNueva });

        if (!actualizada) {
            throw new Error("La foto cambió mientras la editabas. Actualizá e intentá nuevamente.");
        }
    } catch (error) {
        await limpiarImagenEspecieNoReferenciada(fotoNueva, especieId);
        throw error;
    }
    if (fotoAnterior) {
        await limpiarImagenEspecieNoReferenciada(fotoAnterior, especieId);
    }
}

export async function eliminarFotoEspecie(especieId: number): Promise<void> {
    await controlarSesionEnAccion(exigirAdministrador);
    if (!Number.isSafeInteger(especieId) || especieId <= 0) {
        throw new Error("La especie no es válida.");
    }

    const especie = await db.orm.public.Especie
        .select("fotoEspecie")
        .where({ id: especieId })
        .first();

    if (!especie) {
        throw new Error("La especie no existe.");
    }
    const fotoAnterior = especie.fotoEspecie;
    if (!fotoAnterior) {
        return;
    }

    const actualizada = await db.orm.public.Especie
        .where({ id: especieId, fotoEspecie: fotoAnterior })
        .select("id")
        .update({ fotoEspecie: null });

    if (!actualizada) {
        throw new Error("La foto cambió mientras la editabas. Actualizá e intentá nuevamente.");
    }
    await limpiarImagenEspecieNoReferenciada(fotoAnterior, especieId);
}