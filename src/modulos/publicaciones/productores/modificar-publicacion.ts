import { normalizarSeleccionPublicacion, validarCatalogosSeleccion, type SeleccionPublicacion } from "../seleccion-publicacion";
import { db } from "@/infraestructura/persistencia/prisma/db";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { mapearPublicacionMiMercadoProductor } from "../mi-mercado/consultas-mi-mercado-productor";
import { eliminarImagenPublicacionGestionada, ErrorImagenPublicacion, guardarImagenPublicacion } from "../operadores/imagenes-publicacion";
import { limpiarImagenPublicacionNoReferenciada } from "../operadores/limpiar-imagen-publicacion";
import { normalizarPrecioPublicacion, precioPublicacionValido, PRECIO_PUBLICACION_INVALIDO } from "../precio-publicacion";
import { validarUbicacionesProductor, type UbicacionPublicacionProductor } from "./ubicaciones-productor";

type Cliente = Pick<typeof db, "orm">;
type PrecioDb = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];
type CantidadUnidadesDb = Parameters<typeof db.orm.public.Publicacion.create>[0]["cantidadUnidades"];

export type CambiosPublicacionProductor = Omit<SeleccionPublicacion, "paisId"> & {
    paisId?: number | null;
    precio: string | null;
    foto?: string | null;
    cantidadUnidades?: number | null;
    disponible?: boolean;
    ubicaciones: UbicacionPublicacionProductor[];
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

function validarCambios(entrada: unknown): CambiosPublicacionProductor {
    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) datosInvalidos("Los cambios no son válidos.");
    const datos = entrada as Record<string, unknown>;
    const seleccion = normalizarSeleccionPublicacion(datos);
    if (!seleccion.esValido) datosInvalidos(seleccion.errores.join(" "));
    if (datos.cantidadUnidades !== undefined && datos.cantidadUnidades !== null &&
        (typeof datos.cantidadUnidades !== "number" || !Number.isSafeInteger(datos.cantidadUnidades) || datos.cantidadUnidades < 0 || datos.cantidadUnidades > 2147483647)) {
        datosInvalidos("La cantidad de unidades debe ser un número entero entre 0 y 2147483647, o quedar sin informar.");
    }
    if (datos.disponible !== undefined && typeof datos.disponible !== "boolean") {
        datosInvalidos("La disponibilidad no es válida.");
    }
    if (datos.precio !== undefined && !precioPublicacionValido(datos.precio)) {
        datosInvalidos(PRECIO_PUBLICACION_INVALIDO);
    }
    if (datos.foto !== undefined && datos.foto !== null && typeof datos.foto !== "string") datosInvalidos("La fotografía no es válida.");
    const ubicaciones = validarUbicacionesProductor(datos.ubicaciones);
    if (!ubicaciones.esValido) datosInvalidos(ubicaciones.error);
    return { ...seleccion.seleccion, paisId: datos.paisId === undefined ? undefined : seleccion.seleccion.paisId, precio: normalizarPrecioPublicacion(datos.precio as string | null | undefined), foto: datos.foto as string | null | undefined,
        cantidadUnidades: datos.cantidadUnidades as number | null | undefined,
        disponible: datos.disponible as boolean | undefined, ubicaciones: ubicaciones.ubicaciones };
}

async function consultarPublicacion(publicacionProductorId: number, cliente: Cliente) {
    return cliente.orm.public.PublicacionProductor
        .where({ id: publicacionProductorId })
        .include("productor", (productor) => productor.select("id", "usuarioId", "nombreFantasia"))
        .include("pais", (pais) => pais.select("nombrePais"))
        .include("ubicaciones", (ubicaciones) => ubicaciones.select("id", "nombreUbicacion", "urlMaps", "departamento"))
        .include("publicacion", (publicacion) => publicacion
            .select("id", "foto", "precio", "cantidadUnidades", "fecha", "publicacionActiva", "publicacionDisponible", "tipoPublicacion")
            .include("presentacion", (presentacion) => presentacion.include("variedad", (variedad) => variedad.include("especie")))
            .include("especie").include("variedad").include("categoria").include("calibre"))
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
            await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1720, ${objetivo.productorId})`
                .returnsRow({ locked: "pg/int4@1" }).build());
            await tx.execute(db.raw.sql`SELECT id FROM "publicacionProductor" WHERE id = ${publicacionProductorId} FOR UPDATE`
                .returnsRow({ id: "pg/int4@1" }).build());
            const relacion = await obtenerPublicacionProductorEditable(sesion, publicacionProductorId, tx);
            const publicacion = relacion.publicacion;
            const seleccionActual = { ...cambios, paisId: cambios.paisId === undefined ? relacion.paisId : cambios.paisId };
            if (!await validarCatalogosSeleccion(tx, seleccionActual)) {
                datosInvalidos("La selección contiene datos que ya no están disponibles o no corresponden a la especie.");
            }

            const propias = await tx.orm.public.PublicacionProductor.where({ productorId: relacion.productor.id })
                .include("publicacion", (publicacion) => publicacion.select("especieId", "variedadId", "presentacionId", "categoriaId", "calibreId"))
                .all();
            if (propias.some((otra) => otra.id !== relacion.id && otra.paisId === seleccionActual.paisId &&
                otra.publicacion.especieId === cambios.especieId && otra.publicacion.variedadId === cambios.variedadId &&
                otra.publicacion.presentacionId === cambios.presentacionId &&
                otra.publicacion.categoriaId === cambios.categoriaId && otra.publicacion.calibreId === cambios.calibreId)) {
                datosInvalidos("Este Productor ya tiene una publicación con la misma especie, variedad, presentación, categoría, calibre y país.");
            }

            let foto = cambios.foto === null ? null : publicacion.foto;
            if (fotoNueva) {
                foto = await guardarImagenPublicacion(publicacion.id, fotoNueva, tx);
                imagenCreada = { url: foto, publicacionId: publicacion.id };
            }
            // temporal.updatedAt() renueva fecha en este UPDATE, también si sólo cambian ubicaciones.
            await tx.orm.public.Publicacion.where({ id: publicacion.id }).update({
                precio: cambios.precio as PrecioDb, foto, especieId: cambios.especieId, variedadId: cambios.variedadId, presentacionId: cambios.presentacionId,
                categoriaId: cambios.categoriaId, calibreId: cambios.calibreId,
                ...(cambios.cantidadUnidades !== undefined ? { cantidadUnidades: cambios.cantidadUnidades as CantidadUnidadesDb } : {}),
                ...(cambios.disponible !== undefined ? { publicacionDisponible: cambios.disponible } : {}),
            });
            if (cambios.paisId !== undefined) {
                await tx.orm.public.PublicacionProductor.where({ id: relacion.id }).update({ paisId: cambios.paisId });
            }
            const departamentosAnteriores = new Map(relacion.ubicaciones.map((ubicacion) => [ubicacion.urlMaps.trim(), ubicacion.departamento]));
            await tx.orm.public.Ubicacion.where({ publicacionId: relacion.id }).deleteAll();
            for (const ubicacion of cambios.ubicaciones) {
                const departamento = ubicacion.departamento === undefined
                    ? departamentosAnteriores.get(ubicacion.urlMaps.trim())
                    : ubicacion.departamento;
                await tx.orm.public.Ubicacion.create({
                    ...ubicacion, publicacionId: relacion.id,
                    ...(departamento !== undefined ? { departamento } : {}),
                });
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
