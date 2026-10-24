import { db } from "@/infraestructura/persistencia/prisma/db";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { mapearPublicacionMiMercadoProductor } from "../mi-mercado/consultas-mi-mercado-productor";
import { eliminarImagenPublicacionGestionada, ErrorImagenPublicacion, guardarImagenPublicacion } from "../operadores/imagenes-publicacion";
import { limpiarImagenPublicacionNoReferenciada } from "../operadores/limpiar-imagen-publicacion";
import { normalizarPrecioPublicacion, precioPublicacionValido, PRECIO_PUBLICACION_INVALIDO } from "../precio-publicacion";

type Cliente = Pick<typeof db, "orm">;
type PrecioDb = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];
type CantidadUnidadesDb = Parameters<typeof db.orm.public.Publicacion.create>[0]["cantidadUnidades"];

export type CambiosPublicacionProductor = {
    precio: string | null;
    foto?: string | null;
    presentacionId: number;
    categoriaId: number;
    calibreId: number;
    paisId?: number;
    cantidadUnidades?: number | null;
    disponible?: boolean;
    ubicaciones: { nombreUbicacion: string; urlMaps: string }[];
};

export class ErrorEdicionPublicacionProductor extends Error {
    constructor(public readonly codigo: "DATOS_INVALIDOS" | "NO_ENCONTRADA", mensaje: string) {
        super(mensaje);
        this.name = "ErrorEdicionPublicacionProductor";
    }
}

function datosInvalidos(mensaje: string): never {
    throw new ErrorEdicionPublicacionProductor("DATOS_INVALIDOS", mensaje);
}

function esUrlGoogleMaps(valor: string): boolean {
    try {
        const url = new URL(valor);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return false;
        const host = url.hostname.toLowerCase();
        if (host === "maps.app.goo.gl") return url.pathname.length > 1;
        if (host === "goo.gl") return /^\/maps\/.+/.test(url.pathname);
        if (host === "maps.google.com") return true;
        return ["google.com", "www.google.com", "google.com.uy", "www.google.com.uy", "google.com.ar", "www.google.com.ar"]
            .includes(host) && /^\/maps(?:\/|$)/.test(url.pathname);
    } catch {
        return false;
    }
}

function validarCambios(entrada: unknown): CambiosPublicacionProductor {
    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) datosInvalidos("Los cambios no son válidos.");
    const datos = entrada as Record<string, unknown>;
    for (const campo of ["presentacionId", "categoriaId", "calibreId"]) {
        if (typeof datos[campo] !== "number" || !Number.isSafeInteger(datos[campo]) || (datos[campo] as number) <= 0 || (datos[campo] as number) > 2147483647) {
            datosInvalidos("La presentación, categoría y calibre deben ser válidos.");
        }
    }
    if (datos.paisId !== undefined && (typeof datos.paisId !== "number" || !Number.isSafeInteger(datos.paisId) || datos.paisId <= 0 || datos.paisId > 2147483647)) {
        datosInvalidos("El país no es válido.");
    }
    if (datos.cantidadUnidades !== undefined && datos.cantidadUnidades !== null &&
        (typeof datos.cantidadUnidades !== "number" || !Number.isSafeInteger(datos.cantidadUnidades) || datos.cantidadUnidades < 0 || datos.cantidadUnidades > 2147483647)) {
        datosInvalidos("La cantidad de unidades debe ser un número entero entre 0 y 2147483647, o quedar sin informar.");
    }
    if (datos.disponible !== undefined && typeof datos.disponible !== "boolean") {
        datosInvalidos("La disponibilidad no es válida.");
    }
    if (!precioPublicacionValido(datos.precio)) {
        datosInvalidos(PRECIO_PUBLICACION_INVALIDO);
    }
    if (datos.foto !== undefined && datos.foto !== null && typeof datos.foto !== "string") datosInvalidos("La fotografía no es válida.");
    if (!Array.isArray(datos.ubicaciones)) datosInvalidos("Las ubicaciones no son válidas.");
    if (datos.ubicaciones.length > 20) datosInvalidos("Se permiten hasta 20 ubicaciones por publicación.");
    const ubicaciones = datos.ubicaciones.map((ubicacion: unknown) => {
        if (!ubicacion || typeof ubicacion !== "object" || Array.isArray(ubicacion)) datosInvalidos("La ubicación no es válida.");
        const { nombreUbicacion, urlMaps } = ubicacion as Record<string, unknown>;
        if (typeof nombreUbicacion !== "string" || !nombreUbicacion.trim() || nombreUbicacion.trim().length > 200) datosInvalidos("Cada ubicación debe tener un nombre de hasta 200 caracteres.");
        if (typeof urlMaps !== "string" || urlMaps.trim().length > 2048 || !esUrlGoogleMaps(urlMaps.trim())) datosInvalidos("Cada ubicación debe incluir un enlace válido de Google Maps de hasta 2048 caracteres.");
        return { nombreUbicacion: nombreUbicacion.trim(), urlMaps: urlMaps.trim() };
    });
    return { precio: normalizarPrecioPublicacion(datos.precio), foto: datos.foto as string | null | undefined,
        presentacionId: datos.presentacionId as number, categoriaId: datos.categoriaId as number, calibreId: datos.calibreId as number,
        paisId: datos.paisId as number | undefined, cantidadUnidades: datos.cantidadUnidades as number | null | undefined,
        disponible: datos.disponible as boolean | undefined, ubicaciones };
}

async function consultarPublicacion(publicacionProductorId: number, cliente: Cliente) {
    return cliente.orm.public.PublicacionProductor
        .where({ id: publicacionProductorId })
        .include("productor", (productor) => productor.select("id", "usuarioId", "nombreFantasia"))
        .include("pais", (pais) => pais.select("nombrePais"))
        .include("ubicaciones", (ubicaciones) => ubicaciones.select("id", "nombreUbicacion", "urlMaps"))
        .include("publicacion", (publicacion) => publicacion
            .select("id", "foto", "precio", "cantidadUnidades", "fecha", "publicacionActiva", "publicacionDisponible", "tipoPublicacion")
            .include("presentacion", (presentacion) => presentacion.include("variedad", (variedad) => variedad.include("especie")))
            .include("categoria").include("calibre"))
        .first();
}

export async function obtenerPublicacionProductorEditable(sesion: DatosSesion, publicacionProductorId: number, cliente: Cliente = db) {
    if (!Number.isSafeInteger(publicacionProductorId) || publicacionProductorId <= 0 || publicacionProductorId > 2147483647) datosInvalidos("La publicación no es válida.");
    if (sesion.rol !== "PRODUCTOR" && sesion.rol !== "ADMINISTRADOR") {
        throw new ErrorAutorizacion(403, "No tenés permiso para modificar esta publicación.");
    }
    const relacion = await consultarPublicacion(publicacionProductorId, cliente);
    if (!relacion || relacion.publicacion.tipoPublicacion !== "PRODUCTOR") {
        throw new ErrorEdicionPublicacionProductor("NO_ENCONTRADA", "La publicación no existe.");
    }
    if (!autorizado("productor.publicacion.modificar", sesion, relacion.productor)) {
        throw new ErrorAutorizacion(403, "No tenés permiso para modificar esta publicación.");
    }
    return relacion;
}

export async function modificarPublicacionProductor(sesion: DatosSesion, publicacionProductorId: number, entrada: unknown, fotoNueva?: File | null) {
    if (!Number.isSafeInteger(publicacionProductorId) || publicacionProductorId <= 0 || publicacionProductorId > 2147483647) datosInvalidos("La publicación no es válida.");
    const cambios = validarCambios(entrada);
    let imagenCreada: { url: string; publicacionId: number } | null = null;
    let resultado;
    try {
        resultado = await db.transaction(async (tx) => {
            const objetivo = await tx.orm.public.PublicacionProductor.where({ id: publicacionProductorId }).select("productorId").first();
            if (!objetivo) throw new ErrorEdicionPublicacionProductor("NO_ENCONTRADA", "La publicación no existe.");
            // Comparte el bloqueo del alta y la baja para preservar la unicidad del catálogo.
            await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1720, ${objetivo.productorId})`
                .returnsRow({ locked: "pg/int4@1" }).build());
            // Mantiene el orden relación -> publicación usado por la baja.
            await tx.execute(db.raw.sql`SELECT id FROM "publicacionProductor" WHERE id = ${publicacionProductorId} FOR UPDATE`
                .returnsRow({ id: "pg/int4@1" }).build());
            const relacion = await obtenerPublicacionProductorEditable(sesion, publicacionProductorId, tx);
            const publicacion = relacion.publicacion;
            const presentacion = await tx.orm.public.Presentacion.where({ id: cambios.presentacionId })
                .include("variedad", (variedad) => variedad.include("especie")).first();
            if (!presentacion || !presentacion.presentacionActiva || !presentacion.variedad.variedadActiva || !presentacion.variedad.especie.especieActiva) {
                datosInvalidos("La presentación seleccionada no está activa.");
            }
            const categoria = await tx.orm.public.Categoria.where({ id: cambios.categoriaId }).first();
            if (!categoria || (categoria.especieId !== null && categoria.especieId !== presentacion.variedad.especieId)) {
                datosInvalidos("La categoría no corresponde a la especie de la publicación.");
            }
            if (!await tx.orm.public.Calibre.where({ id: cambios.calibreId }).first()) datosInvalidos("El calibre no existe.");
            if (cambios.paisId !== undefined && !await tx.orm.public.Pais.where({ id: cambios.paisId }).select("id").first()) {
                datosInvalidos("El país no existe.");
            }

            const propias = await tx.orm.public.PublicacionProductor.where({ productorId: relacion.productor.id })
                .include("publicacion", (publicacion) => publicacion.select("presentacionId", "categoriaId", "calibreId"))
                .all();
            if (propias.some((otra) => otra.id !== relacion.id &&
                otra.publicacion.presentacionId === cambios.presentacionId &&
                otra.publicacion.categoriaId === cambios.categoriaId && otra.publicacion.calibreId === cambios.calibreId)) {
                datosInvalidos("Este Productor ya tiene una publicación con la misma especie, variedad, presentación, categoría y calibre.");
            }

            let foto = cambios.foto === null ? null : publicacion.foto;
            if (fotoNueva) {
                foto = await guardarImagenPublicacion(publicacion.id, fotoNueva);
                imagenCreada = { url: foto, publicacionId: publicacion.id };
            }
            // temporal.updatedAt() renueva fecha en este UPDATE, también si sólo cambian ubicaciones.
            await tx.orm.public.Publicacion.where({ id: publicacion.id }).update({
                precio: cambios.precio as PrecioDb, foto, presentacionId: cambios.presentacionId,
                categoriaId: cambios.categoriaId, calibreId: cambios.calibreId,
                ...(cambios.cantidadUnidades !== undefined ? { cantidadUnidades: cambios.cantidadUnidades as CantidadUnidadesDb } : {}),
                ...(cambios.disponible !== undefined ? { publicacionDisponible: cambios.disponible } : {}),
            });
            if (cambios.paisId !== undefined) {
                await tx.orm.public.PublicacionProductor.where({ id: relacion.id }).update({ paisId: cambios.paisId });
            }
            await tx.orm.public.Ubicacion.where({ publicacionId: relacion.id }).deleteAll();
            for (const ubicacion of cambios.ubicaciones) {
                await tx.orm.public.Ubicacion.create({ ...ubicacion, publicacionId: relacion.id });
            }
            const actualizada = await consultarPublicacion(relacion.id, tx);
            if (!actualizada) throw new Error("No se pudo leer la publicación guardada.");
            return { publicacion: mapearPublicacionMiMercadoProductor(actualizada), productorId: relacion.productor.id,
                fotoAnterior: publicacion.foto, fotoActual: foto };
        });
    } catch (error) {
        if (imagenCreada) {
            const imagen = imagenCreada as { url: string; publicacionId: number };
            await limpiarImagenPublicacionNoReferenciada(imagen.url, imagen.publicacionId);
        }
        if (error instanceof ErrorImagenPublicacion) datosInvalidos(error.message);
        throw error;
    }
    if (resultado.fotoAnterior !== resultado.fotoActual) {
        await eliminarImagenPublicacionGestionada(resultado.fotoAnterior, resultado.publicacion.id)
            .catch((error) => console.error("No se pudo eliminar la imagen anterior:", error));
    }
    return { publicacion: resultado.publicacion, productorId: resultado.productorId };
}
