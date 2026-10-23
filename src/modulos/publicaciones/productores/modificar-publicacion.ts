import { db } from "@/infraestructura/persistencia/prisma/db";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { mapearPublicacionMiMercadoProductor } from "../mi-mercado/consultas-mi-mercado-productor";
import { eliminarImagenPublicacionGestionada, ErrorImagenPublicacion, guardarImagenPublicacion } from "../operadores/imagenes-publicacion";

type Cliente = Pick<typeof db, "orm">;
type PrecioDb = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];

export type CambiosPublicacionProductor = {
    precio: string | null;
    foto?: string | null;
    presentacionId: number;
    categoriaId: number;
    calibreId: number;
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
    if (datos.precio !== null && (typeof datos.precio !== "string" || !/^(0|[1-9]\d{0,9})$/.test(datos.precio.trim()))) {
        datosInvalidos("El precio debe ser un número entero de hasta 10 dígitos, sin decimales.");
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
    return { precio: datos.precio === null ? null : (datos.precio as string).trim(), foto: datos.foto as string | null | undefined,
        presentacionId: datos.presentacionId as number, categoriaId: datos.categoriaId as number, calibreId: datos.calibreId as number, ubicaciones };
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
            // Serializa las ediciones de la misma publicación, incluidas sus ubicaciones.
            await tx.execute(db.raw.sql`SELECT id FROM "publicacionProductor" WHERE id = ${publicacionProductorId} FOR UPDATE`
                .returnsRow({ id: "pg/int4@1" }).build());
            const relacion = await obtenerPublicacionProductorEditable(sesion, publicacionProductorId, tx);
            const publicacion = relacion.publicacion;
            const presentacion = await tx.orm.public.Presentacion.where({ id: cambios.presentacionId })
                .include("variedad", (variedad) => variedad.include("especie")).first();
            if (!presentacion || !presentacion.presentacionActiva || !presentacion.variedad.variedadActiva || !presentacion.variedad.especie.especieActiva) {
                datosInvalidos("La presentación seleccionada no está activa.");
            }
            if (presentacion.variedadId !== publicacion.presentacion.variedadId) datosInvalidos("La presentación debe pertenecer a la misma variedad.");
            const categoria = await tx.orm.public.Categoria.where({ id: cambios.categoriaId }).first();
            if (!categoria || (categoria.especieId !== null && categoria.especieId !== presentacion.variedad.especieId)) {
                datosInvalidos("La categoría no corresponde a la especie de la publicación.");
            }
            if (!await tx.orm.public.Calibre.where({ id: cambios.calibreId }).first()) datosInvalidos("El calibre no existe.");

            let foto = cambios.foto === null ? null : publicacion.foto;
            if (fotoNueva) {
                foto = await guardarImagenPublicacion(publicacion.id, fotoNueva);
                imagenCreada = { url: foto, publicacionId: publicacion.id };
            }
            // temporal.updatedAt() renueva fecha en este UPDATE, también si sólo cambian ubicaciones.
            await tx.orm.public.Publicacion.where({ id: publicacion.id }).update({
                precio: cambios.precio as PrecioDb, foto, presentacionId: cambios.presentacionId,
                categoriaId: cambios.categoriaId, calibreId: cambios.calibreId,
            });
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
            await eliminarImagenPublicacionGestionada(imagen.url, imagen.publicacionId).catch((errorLimpieza) => console.error("No se pudo eliminar la imagen descartada:", errorLimpieza));
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
