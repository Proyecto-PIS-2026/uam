import { db } from "../../../infraestructura/persistencia/prisma/db";
import { notificarCambioPublicacion } from "@/infraestructura/tiempo-real/publicaciones";
import type { Numeric } from "@prisma/orm-postgres/target/codec-types";
import { MAXIMO_PRECIO_PUBLICACION } from "../precio-publicacion";

export class PublicacionNoEncontradaError extends Error {
    constructor() {
        super("La publicación no existe o no pertenece al operador.");
    }
}

export async function obtenerPublicacionesDeOperador(operadorId: number) {
    const publicaciones = await db.orm.public.PublicacionOperador 
        .where({ operadorId })
        .include("publicacion", (pub) =>
            pub
                .select(
                    "id",
                    "foto",
                    "precio",
                    "cantidadUnidades",
                    "fecha",
                    "version",
                    "publicacionActiva",
                    "publicacionDisponible",
                )
                .include("presentacion", (pres) =>
                    pres.include("variedad", (variedad) =>
                        variedad.include("especie"))
                )
                .include("categoria")
                .include("calibre")
        );
    
    const resultado = await publicaciones.all();
    return resultado;
}

export type PrecioActualizado = { precio: number | null; fecha: string; version: number };

export class ConflictoPublicacionError extends Error {
    constructor(public readonly actual: PrecioActualizado) {
        super("La publicación cambió en otra sesión. Revisá el precio actualizado antes de volver a guardar.");
    }
}

function validarPrecio(precio: number | null) {
    if (precio === null) return;
    if (!Number.isFinite(precio) || precio <= 0) throw new Error("El precio debe ser un número mayor a cero.");
    if (!Number.isInteger(precio)) throw new Error("El precio debe ser un número entero, sin decimales.");
    if (precio > MAXIMO_PRECIO_PUBLICACION) throw new Error("El precio excede el valor máximo permitido.");
}

export async function actualizarPrecioPublicacion(operadorId: number, publicacionId: number, nuevoPrecio: number | null, versionEsperada?: number) {
    validarPrecio(nuevoPrecio);
    return guardarPrecio(operadorId, publicacionId, nuevoPrecio, false, versionEsperada);
}

export async function incrementarPrecioPublicacion(operadorId: number, publicacionId: number, incremento: number) {
    if (!Number.isSafeInteger(incremento) || incremento === 0 || Math.abs(incremento) > MAXIMO_PRECIO_PUBLICACION) {
        throw new Error("El incremento no es válido.");
    }
    return guardarPrecio(operadorId, publicacionId, incremento, true);
}

async function guardarPrecio(operadorId: number, publicacionId: number, valor: number | null, incrementar: boolean, versionEsperada?: number): Promise<PrecioActualizado> {
    return db.transaction(async (tx) => {
        await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ${operadorId})`
            .returnsRow({ locked: "pg/int4@1" }).build());
        const pertenencia = await tx.orm.public.PublicacionOperador.where({ operadorId, publicacionId }).all();
        if (pertenencia.length === 0) throw new PublicacionNoEncontradaError();
        const actual = await tx.orm.public.Publicacion.select("precio", "version", "fecha").where({ id: publicacionId }).first();
        if (!actual) throw new PublicacionNoEncontradaError();
        if (!incrementar && (!Number.isSafeInteger(versionEsperada) || versionEsperada !== actual.version)) {
            throw new ConflictoPublicacionError({ precio: actual.precio === null ? null : Number(actual.precio), fecha: actual.fecha.toString(), version: actual.version });
        }
        const precio = incrementar ? Number(actual.precio ?? 0) + (valor as number) : valor;
        validarPrecio(precio);
        const actualizada = await tx.orm.public.Publicacion.where({ id: publicacionId, version: actual.version })
            .update({ precio: precio === null ? null : precio.toFixed(2) as Numeric<12, 2>, version: actual.version + 1 });
        if (!actualizada) {
            const vigente = await tx.orm.public.Publicacion.select("precio", "version", "fecha").where({ id: publicacionId }).first();
            if (!vigente) throw new PublicacionNoEncontradaError();
            throw new ConflictoPublicacionError({ precio: vigente.precio === null ? null : Number(vigente.precio), fecha: vigente.fecha.toString(), version: vigente.version });
        }
        await notificarCambioPublicacion(tx, { operadorId, publicacionId });
        return { precio: actualizada.precio === null ? null : Number(actualizada.precio), fecha: actualizada.fecha.toString(), version: actualizada.version };
    });
}
